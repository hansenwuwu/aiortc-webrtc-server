from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from routers import rtc, websocket
from fastapi.middleware.cors import CORSMiddleware

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

app.include_router(rtc.router)
# app.include_router(websocket.router)

@app.get("/")
async def root():
    return {"message": "Hello World"}



"""
    WebSocket
"""
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def send_personal_message(self, message: str, websocket: WebSocket):
        await websocket.send_text(message)

    async def broadcast(self, message: str):
        for connection in self.active_connections:
            await connection.send_text(message)


manager = ConnectionManager()

@app.websocket("/ws/{client_id}")
async def websocket_endpoint(websocket: WebSocket, client_id: int):
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            # await manager.send_personal_message(f"You wrote: {data}", websocket)
            print(f"Receive from Client #{client_id} data: {data}")
            # await manager.broadcast(f"Client #{client_id} says: {data}")
    except WebSocketDisconnect:
        manager.disconnect(websocket)
        await manager.broadcast(f"Client #{client_id} left the chat")
    
@app.on_event("shutdown")
async def shutdown_event():
    await rtc.onShutdown()
    print('shutdown')