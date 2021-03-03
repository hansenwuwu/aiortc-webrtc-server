from fastapi import FastAPI
from pydantic import BaseModel
from typing import Optional
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse

import uuid
import logging

# aiortc
from aiortc import RTCPeerConnection, RTCSessionDescription, MediaStreamTrack

class Params(BaseModel):
    sdp: str
    type: str

logger = logging.getLogger("pc")

app = FastAPI()

@app.post("/offer_reflect")
async def offer_reflect(params: Params):
    
    offer = RTCSessionDescription(sdp=params.sdp, type=params.type)

    id = 'hololens'
    name = "visitor-(%s)" % uuid.uuid4()
    print('name: ', name)

    pc = RTCPeerConnection()
    pc_id = "PeerConnection(%s)" % uuid.uuid4()
    
    # pcs.add(pc)
    # id_list.append(pc_id)
    # name_dict[pc_id] = name
    # pc_dict[pc_id] = pc

    def log_info(msg, *args):
        logger.info(pc_id + " " + msg, *args)

    log_info("Created for %s", pc_id)

    @pc.on("iceconnectionstatechange")
    async def on_iceconnectionstatechange():
        print("ICE connection state is %s", pc.iceConnectionState)
        if pc.iceConnectionState == "failed":
            await pc.close()
            # pcs.discard(pc)
        
    # @pc.on("datachannel")
    # def on_datachannel(channel):
    #     channel_log(channel, "-", "created by remote party")
        
    #     @channel.on("message")
    #     def on_message(message):
    #         channel_log(channel, "<", message)

    @pc.on("track")
    def on_track(track):
        log_info("Track %s received", track.kind)
        if track.kind == "audio":
            print("add audio track")
            pc.addTrack(track)
        elif track.kind == "video":
            print("add video track")
            pc.addTrack(track)
            
        @track.on("ended")
        async def on_ended():
            print("Track %s ended", track.kind)
            await pc.close()

    # handle offer
    await pc.setRemoteDescription(offer)
    # await recorder.start()

    # send answer
    answer = await pc.createAnswer()
    await pc.setLocalDescription(answer)

    json_compatible_item_data = jsonable_encoder({"sdp": pc.localDescription.sdp, "type": pc.localDescription.type})
    return JSONResponse(content=json_compatible_item_data)


@app.get("/")
async def root():
    return {"message": "Hello World"}