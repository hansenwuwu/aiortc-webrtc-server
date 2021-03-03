from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse
from aiortc import RTCPeerConnection, RTCSessionDescription, MediaStreamTrack
import uuid
from tools.videoTransformTrack import VideoTransformTrack

class Params(BaseModel):
    sdp: str
    type: str

router = APIRouter(
    prefix="/api/v1/rtc",
    tags=["rtc"]
)

@router.post("/offer_reflect")
async def offer_reflect(params: Params):
    
    offer = RTCSessionDescription(sdp=params.sdp, type=params.type)

    id = 'hololens'
    name = "visitor-(%s)" % uuid.uuid4()
    print('name: ', name)

    pc = RTCPeerConnection()
    pc_id = "PeerConnection(%s)" % uuid.uuid4()

    @pc.on("iceconnectionstatechange")
    async def on_iceconnectionstatechange():
        print("ICE connection state is %s", pc.iceConnectionState)
        if pc.iceConnectionState == "failed":
            await pc.close()
    
    @pc.on("connectionstatechange")
    async def on_connectionstatechange():
        print("connection state is %s", pc.connectionState)

    @pc.on("track")
    def on_track(track):
        print("Track %s received", track.kind)
        if track.kind == "audio":
            print("add audio track")
            pc.addTrack(track)
        elif track.kind == "video":
            print("add video track")
            local_video = VideoTransformTrack(
                track, transform="object-detection"
            )
            pc.addTrack(local_video)
            
        @track.on("ended")
        async def on_ended():
            print("Track %s ended", track.kind)
            await pc.close()

    await pc.setRemoteDescription(offer)
    # await recorder.start()

    answer = await pc.createAnswer()
    await pc.setLocalDescription(answer)

    json_compatible_item_data = jsonable_encoder({"sdp": pc.localDescription.sdp, "type": pc.localDescription.type})
    return JSONResponse(content=json_compatible_item_data)