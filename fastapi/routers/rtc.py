from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse
from aiortc import RTCPeerConnection, RTCSessionDescription, MediaStreamTrack
from aiortc.contrib.media import MediaBlackhole, MediaPlayer, MediaRecorder
import uuid
from tools.videoTransformTrack import VideoTransformTrack
from tools.janus import JanusSession
import aiohttp

pcs = set()
VideoTrackDict = {}
AudioTrackDict = {}

JANUS_SERVER = 'http://192.168.4.200:8088/janus'

class Params(BaseModel):
    sdp: str
    type: str

router = APIRouter(
    prefix="/api/v1/rtc",
    tags=["rtc"]
)

'''
    hololens send offer to aiortc
    aiortc reflect video to hololens
'''
@router.post("/offer_reflect")
async def offer_reflect(params: Params):
    
    offer = RTCSessionDescription(sdp=params.sdp, type=params.type)

    id = 'hololens'
    name = "visitor-(%s)" % uuid.uuid4()
    print('name: ', name)

    pc = RTCPeerConnection()
    pcs.add(pc)
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

'''
    mode:
        record: record to mp4 file
        janus: send object detection video to janus
'''
@router.get("/subscribe-to-janus/{mode}")
async def subscribe_to_janus(room: int = -1, publishId: int = -1, mode='janus'):
    print('room: ', room)
    print('publishId: ', publishId)
    print('mode: ', mode)

    if room == -1 or publishId == -1:
        json_compatible_item_data = jsonable_encoder({'message': 'no such room or publish id'})
        return JSONResponse(content=json_compatible_item_data)

    peerId = publishId
    
    session = JanusSession(JANUS_SERVER)
    await session.create()
    plugin = await session.attach("janus.plugin.videoroom")
    
    if mode == 'record':
        recorder = MediaRecorder('/Users/hs/Documents/GitHub/aiortc-webrtc-server/fastapi/storage/file.mp4')
        await subscribe(session=session, room=room, publishId=publishId, peerId=peerId, recorder=recorder)
    elif mode == 'janus':
        await subscribe(session=session, room=room, publishId=publishId, peerId=peerId)
        # publish
        response = await plugin.send(
            {
                "body": {
                    "display": "aiortc",
                    "ptype": "publisher",
                    "request": "join",
                    "room": room,
                }
            }
        )
        publishers = response["plugindata"]["data"]["publishers"]
        for publisher in publishers:
            print("id: %(id)s, display: %(display)s" % publisher)
        
        await publish(plugin=plugin, peerId=peerId)
        
    json_compatible_item_data = jsonable_encoder({'message': 'success'})
    return JSONResponse(content=json_compatible_item_data)

async def subscribe(session, room, publishId, peerId, recorder=None ):
    pc = RTCPeerConnection()
    pcs.add(pc)
    subscribeId = 'subscriber - ' + str(peerId)

    @pc.on("iceconnectionstatechange")
    async def on_iceconnectionstatechange():
        print("%s ICE connection state is %s" % (subscribeId, pc.iceConnectionState))
        if pc.iceConnectionState == "failed":
            await pc.close()
    
    @pc.on("connectionstatechange")
    async def on_connectionstatechange():
        print("%s connection state is %s" % (subscribeId, pc.connectionState))

    @pc.on("track")
    async def on_track(track):
        print("%s Track %s received" % ( subscribeId, track.kind))
        if track.kind == "video":
            local_video = VideoTransformTrack(
                track, transform="object-detection"
            )
            if recorder != None:
                recorder.addTrack(local_video)
            else:
                VideoTrackDict[peerId] = local_video
        if track.kind == "audio":
            if recorder != None:
                recorder.addTrack(track)
            else:
                AudioTrackDict[peerId] = track
        
        @track.on("ended")
        async def on_ended():
            print("%s Track %s ended" % (subscribeId, track.kind))
            await recorder.stop()
    
    plugin = await session.attach("janus.plugin.videoroom")
    response = await plugin.send(
        {"body": {"request": "join", "ptype": "subscriber", "room": room, "feed": publishId}}
    )

    await pc.setRemoteDescription(
        RTCSessionDescription(
            sdp=response["jsep"]["sdp"], type=response["jsep"]["type"]
        )
    )

    # send answer
    await pc.setLocalDescription(await pc.createAnswer())
    response = await plugin.send(
        {
            "body": {"request": "start"},
            "jsep": {
                "sdp": pc.localDescription.sdp,
                "trickle": False,
                "type": pc.localDescription.type,
            },
        }
    )
    if recorder != None:
        await recorder.start()

async def publish(plugin, peerId):
    """
    Send video to the room.
    """
    pc = RTCPeerConnection()
    pcs.add(pc)

    pc.addTrack(VideoTrackDict[peerId])
    pc.addTrack(AudioTrackDict[peerId])

    # send offer
    await pc.setLocalDescription(await pc.createOffer())
    request = {"request": "configure"}
    # request.update(media)
    response = await plugin.send(
        {
            "body": request,
            "jsep": {
                "sdp": pc.localDescription.sdp,
                "trickle": False,
                "type": pc.localDescription.type,
            },
        }
    )

    # apply answer
    await pc.setRemoteDescription(
        RTCSessionDescription(
            sdp=response["jsep"]["sdp"], type=response["jsep"]["type"]
        )
    )


async def onShutdown():
    for pc in pcs:
        await pc.close()
    await pcs.clear()
    VideoTrackDict.clear()
    AudioTrackDict.clear()