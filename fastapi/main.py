from fastapi import FastAPI
from routers import rtc

app = FastAPI()

app.include_router(rtc.router)

@app.get("/")
async def root():
    return {"message": "Hello World"}
    
@app.on_event("shutdown")
async def shutdown_event():
    await rtc.onShutdown()
    print('shutdown')