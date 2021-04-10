from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import uvicorn
import json

app = FastAPI()

# origins = [
#    "*"
# ]

# app.add_middleware(
#     CORSMiddleware,
#     allow_origins=origins,
#     allow_credentials=True,
#     allow_methods=["*"],
#     allow_headers=["*"],
# )

app.mount("/static", StaticFiles(directory="static"), name="static")

@app.get("/")
async def root():
    return {"message": "Hello World"}

@app.get("/api/v1/online")
async def online():
    online_list = manager.getOnlineList()
    output = {
        'online': online_list
    }
    return json.dumps(output)

"""
    WebSocket
"""
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []
        self.userWebsocket = {}
        self.userData = {}

    async def connect(self, websocket: WebSocket, client_id, device_type, display_name):
        await websocket.accept()
        self.active_connections.append(websocket)
        self.userWebsocket[client_id] = websocket
        self.userData[client_id] = {
            "display_name": display_name,
            "device_type": device_type
        }

    def disconnect(self, websocket: WebSocket, client_id):
        self.active_connections.remove(websocket)
        del self.userWebsocket[client_id]
        del self.userData[client_id]
        
    async def send_personal_message(self, message: str, websocket: WebSocket):
        await websocket.send_text(message)
    
    async def send_personal_id_message(self, message: str, receiver_id, sender_id):
        websocket = self.userWebsocket[receiver_id]
        # print(websocket)
        output = {
            'type': "message",
            'sender_id': sender_id,
            'sender_name': self.userData[sender_id]['display_name'],
            'sender_type': self.userData[sender_id]['device_type'],
            "value": message
        }
        print(output)
        if websocket == None:
            return
        await websocket.send_text(json.dumps(output))
    
    def getOnlineList(self):
        output = []
        for key, value in self.userWebsocket.items():
            output.append({
                'id': key,
                'device_type': self.userData[key]["device_type"],
                'display_name': self.userData[key]["display_name"]
            })
        return output

    async def broadcast(self, message: str):
        for connection in self.active_connections:
            await connection.send_text(message)


manager = ConnectionManager()

@app.websocket("/ws/{device_type}/{client_id}/{display_name}")
async def websocket_endpoint(websocket: WebSocket, device_type: str, client_id: str, display_name: str):
    await manager.connect(websocket, client_id, device_type, display_name)
    try:
        while True:
            data = await websocket.receive_text()
            try:
                msg = json.loads(data)
                if 'type' in msg:
                    if msg['type'] == 'online':
                        pass
                    elif msg['type'] == 'message':
                        print(f"Receive from Client #{client_id} send_to: {msg['receiver']} value: {msg['value']}")
                        await manager.send_personal_id_message(msg['value'], msg['receiver'], client_id)
                else:
                    await manager.send_personal_id_message(msg['content'], msg['send_to'])
            except Exception as e:
                await manager.send_personal_message(f"Something fail {e}", websocket)
    except WebSocketDisconnect:
        manager.disconnect(websocket, client_id)
        print(f"Client #{client_id} left the chat")
    
@app.on_event("shutdown")
async def shutdown_event():
    await rtc.onShutdown()
    print('shutdown')

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=5000)