from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from routers import rtc, websocket
from fastapi.middleware.cors import CORSMiddleware
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

# app.include_router(rtc.router)

@app.get("/")
async def root():
    return {"message": "Hello World"}

"""
    WebSocket
"""
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []
        self.user_dict = {}

    async def connect(self, websocket: WebSocket, client_id):
        await websocket.accept()
        self.active_connections.append(websocket)
        self.user_dict[client_id] = websocket

    def disconnect(self, websocket: WebSocket, client_id):
        self.active_connections.remove(websocket)
        self.user_dict[client_id] = None
        
    async def send_personal_message(self, message: str, websocket: WebSocket):
        await websocket.send_text(message)
    
    async def send_personal_id_message(self, message: str, client_id):
        # print('SEND TO: ', client_id)
        websocket = self.user_dict[client_id]
        # print(websocket)
        if websocket == None:
            return
        await websocket.send_text(message)

    async def broadcast(self, message: str):
        for connection in self.active_connections:
            await connection.send_text(message)


manager = ConnectionManager()

@app.websocket("/ws/{client_id}")
async def websocket_endpoint(websocket: WebSocket, client_id: str):
    await manager.connect(websocket, client_id)
    try:
        while True:
            data = await websocket.receive_text()
            # await manager.send_personal_message(f"You wrote: {data}", websocket)
            # print(f"Receive from Client #{client_id} data: {data}")
            try:
                msg = json.loads(data)
                print(f"Receive from Client #{client_id} send_to: {msg['send_to']} content: {msg['content']}")
                await manager.send_personal_id_message(msg['content'], msg['send_to'])
                await manager.send_personal_message(f"You send: {msg['content']} to {msg['send_to']}", websocket)
            except Exception as e:
                await manager.send_personal_message(f"Something fail", websocket)
            # await manager.broadcast(f"Client #{client_id} says: {data}")
    except WebSocketDisconnect:
        manager.disconnect(websocket, client_id)
        await manager.broadcast(f"Client #{client_id} left the chat")
    
@app.on_event("shutdown")
async def shutdown_event():
    await rtc.onShutdown()
    print('shutdown')

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=5000)