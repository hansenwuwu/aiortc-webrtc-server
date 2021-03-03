import argparse
import asyncio
import json
import logging
import os
import ssl
import uuid
import time
from random import randint
import random
import queue

import cv2
import numpy as np
from aiohttp import web
import aiohttp
from aiohttp_requests import requests
from av import VideoFrame

from aiortc import RTCPeerConnection, RTCSessionDescription, MediaStreamTrack
from aiortc.contrib.media import MediaBlackhole, MediaPlayer, MediaRecorder

import aiohttp_cors

JANUS_SERVER = 'http://192.168.4.200:8088/janus'

# ------- YOLO -------- #

whT = 320

classesFile = './yolo/coco.names'
classNames = []
with open(classesFile, 'rt') as f:
    classNames = f.read().rstrip('\n').split('\n')
# print(classNames)

modelConfiguration = './yolo/yolov3-tiny.cfg'
modelWeights = './yolo/yolov3-tiny.weights'

net = cv2.dnn.readNetFromDarknet(modelConfiguration, modelWeights)
net.setPreferableBackend(cv2.dnn.DNN_BACKEND_OPENCV)
net.setPreferableTarget(cv2.dnn.DNN_TARGET_CPU)

def findObjects(outputs, img):
    hT, wT, cT = img.shape
    bbox = []
    classIds = []
    confs = []

    for output in outputs:
        for det in output:
            scores = det[5:]
            classId = np.argmax(scores)
            confidence = scores[classId]
            if confidence > 0.5:
                w, h = int( det[2]*wT ), int(det[3]*hT)
                x, y = int(det[0]*wT-w/2), int(det[1]*hT-h/2)
                bbox.append([x,y,w,h])
                classIds.append(classId)
                confs.append(float(confidence))

    indices = cv2.dnn.NMSBoxes(bbox, confs, 0.5, 0.3)
    return indices, bbox, classIds, confs

# --------------------- #

# end of one of the connection won't end track
MediaStreamTrack.stop = lambda x: None

ROOT = os.path.dirname(__file__)

logger = logging.getLogger("pc")
pcs = set()

id_list = []

pc_dict = {}
name_dict = {}
video_track_dict = {}
audio_track_dict = {}

pc_videoTrackId_dict = {}

pc_queue_dict = {}
q = queue.Queue(maxsize=10)

class VideoTransformTrack(MediaStreamTrack):
    """
    A video stream track that transforms frames from an another track.
    """

    kind = "video"

    def __init__(self, track, transform):
        super().__init__()  # don't forget this!
        self.track = track
        self.transform = transform
        self.count = 0

    async def recv(self):
        frame = await self.track.recv()
        # print('get frame: ', frame)

        if self.transform == "cartoon":
            img = frame.to_ndarray(format="bgr24")

            # prepare color
            img_color = cv2.pyrDown(cv2.pyrDown(img))
            for _ in range(6):
                img_color = cv2.bilateralFilter(img_color, 9, 9, 7)
            img_color = cv2.pyrUp(cv2.pyrUp(img_color))

            # prepare edges
            img_edges = cv2.cvtColor(img, cv2.COLOR_RGB2GRAY)
            img_edges = cv2.adaptiveThreshold(
                cv2.medianBlur(img_edges, 7),
                255,
                cv2.ADAPTIVE_THRESH_MEAN_C,
                cv2.THRESH_BINARY,
                9,
                2,
            )
            img_edges = cv2.cvtColor(img_edges, cv2.COLOR_GRAY2RGB)

            # combine color and edges
            img = cv2.bitwise_and(img_color, img_edges)

            # rebuild a VideoFrame, preserving timing information
            new_frame = VideoFrame.from_ndarray(img, format="bgr24")
            new_frame.pts = frame.pts
            new_frame.time_base = frame.time_base
            return new_frame
        elif self.transform == "edges":
            # perform edge detection
            img = frame.to_ndarray(format="bgr24")
            img = cv2.cvtColor(cv2.Canny(img, 100, 200), cv2.COLOR_GRAY2BGR)

            # rebuild a VideoFrame, preserving timing information
            new_frame = VideoFrame.from_ndarray(img, format="bgr24")
            new_frame.pts = frame.pts
            new_frame.time_base = frame.time_base
            return new_frame
        elif self.transform == "rotate":
            # rotate image
            img = frame.to_ndarray(format="bgr24")
            rows, cols, _ = img.shape
            M = cv2.getRotationMatrix2D((cols / 2, rows / 2), frame.time * 45, 1)
            img = cv2.warpAffine(img, M, (cols, rows))

            # rebuild a VideoFrame, preserving timing information
            new_frame = VideoFrame.from_ndarray(img, format="bgr24")
            new_frame.pts = frame.pts
            new_frame.time_base = frame.time_base
            return new_frame
        elif self.transform == "object-detection":

            if self.count == 0:
                start_time = time.time()
                self.count = 1
                img = frame.to_ndarray(format="bgr24")
                
                blob = cv2.dnn.blobFromImage(img, 1/255, (whT,whT), [0,0,0], 1, crop=False)
                net.setInput(blob)

                layerNames = net.getLayerNames()
                outputNames = [ layerNames[i[0]-1] for i in net.getUnconnectedOutLayers() ]
                outputs = net.forward(outputNames)

                indices, bbox, classIds, confs = findObjects(outputs, img)

                result_list = []

                for i in indices:
                    i = i[0]
                    box = bbox[i]
                    x, y, w, h = box[0], box[1], box[2], box[3]
                    cv2.rectangle(img, (x,y), (x+w, y+h), (255, 0, 255), 2)
                    cv2.putText(img, f'{classNames[classIds[i]].upper()} {int(confs[i]*100)}%', 
                        (x, y-10), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255,0,255), 2)
                    # print(f'{classNames[classIds[i]].upper()} {int(confs[i]*100)}% (x, y, w, h) = ({x}, {y}, {w}, {h})')
                    result_list.append({
                            "tag": classNames[classIds[i]].upper(),
                            "confidence": int(confs[i]*100),
                            "x": x,
                            "y": y,
                            "w": w,
                            "h": h
                        })
                    
                # cv2.imshow('frame', img)
                # cv2.waitKey(10)
                new_frame = VideoFrame.from_ndarray(img, format="bgr24")
                new_frame.pts = frame.pts
                new_frame.time_base = frame.time_base

                if q.full():
                    print(q.get())
                    # q.get()
                q.put(result_list)

                # print('Frame - execution time : ', (time.time() - start_time))
                
                return new_frame
            else:
                self.count += 1
                if self.count == 2:
                    self.count = 0
                return frame
        else:
            return frame


# -------- janus --------- #
def transaction_id():
    return ("aiortc-" + str(randint(0, 10000)))

class JanusPlugin:
    def __init__(self, session, url):
        self._queue = asyncio.Queue()
        self._session = session
        self._url = url

    async def send(self, payload):
        message = {"janus": "message", "transaction": transaction_id()}
        message.update(payload)
        async with self._session._http.post(self._url, json=message) as response:
            data = await response.json()
            assert data["janus"] == "ack"

        response = await self._queue.get()
        assert response["transaction"] == message["transaction"]
        return response

class JanusSession:
    def __init__(self, url):
        self._http = None
        self._poll_task = None
        self._plugins = {}
        self._root_url = url
        self._session_url = None

    async def attach(self, plugin_name: str) -> JanusPlugin:
        message = {
            "janus": "attach",
            "plugin": plugin_name,
            "transaction": transaction_id(),
        }
        async with self._http.post(self._session_url, json=message) as response:
            data = await response.json()
            assert data["janus"] == "success"
            plugin_id = data["data"]["id"]
            plugin = JanusPlugin(self, self._session_url + "/" + str(plugin_id))
            self._plugins[plugin_id] = plugin
            return plugin

    async def create(self):
        self._http = aiohttp.ClientSession()
        message = {"janus": "create", "transaction": transaction_id()}
        async with self._http.post(self._root_url, json=message) as response:
            data = await response.json()
            assert data["janus"] == "success"
            session_id = data["data"]["id"]
            self._session_url = self._root_url + "/" + str(session_id)

        self._poll_task = asyncio.ensure_future(self._poll())

    async def destroy(self):
        if self._poll_task:
            self._poll_task.cancel()
            self._poll_task = None

        if self._session_url:
            message = {"janus": "destroy", "transaction": transaction_id()}
            async with self._http.post(self._session_url, json=message) as response:
                data = await response.json()
                assert data["janus"] == "success"
            self._session_url = None

        if self._http:
            await self._http.close()
            self._http = None

    async def _poll(self):
        while True:
            params = {"maxev": 1, "rid": int(time.time() * 1000)}
            async with self._http.get(self._session_url, params=params) as response:
                data = await response.json()
                if data["janus"] == "event":
                    plugin = self._plugins.get(data["sender"], None)
                    if plugin:
                        await plugin._queue.put(data)
                    else:
                        print(data)

async def publish(plugin, pc_id):
    """
    Send video to the room.
    """
    pc = RTCPeerConnection()
    pcs.add(pc)

    # configure media
    # media = {"audio": False, "video": True}
    # if player and player.audio:
    #     pc.addTrack(player.audio)
    #     media["audio"] = True

    # if player and player.video:
    #     pc.addTrack(player.video)
    # else:
    #     pc.addTrack(VideoStreamTrack())

    pc.addTrack(audio_track_dict[pc_id])
    pc.addTrack(video_track_dict[pc_id])

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

async def subscribe(session, room, feed, recorder, pc_id):
    pc = RTCPeerConnection()
    pcs.add(pc)
    pc_dict[pc_id] = pc

    @pc.on("track")
    async def on_track(track):
        print("Track %s received" % track.kind)
        if track.kind == "video":
            local_video = VideoTransformTrack(
                track, transform="object-detection"
            )
            # recorder.addTrack(local_video)
            print('track id: ', track.id)
            video_track_dict[pc_id] = local_video
            # pc_videoTrackId_dict[track.id] = pc_id
        if track.kind == "audio":
            # recorder.addTrack(track)
            audio_track_dict[pc_id] = track

    # subscribe
    plugin = await session.attach("janus.plugin.videoroom")
    response = await plugin.send(
        {"body": {"request": "join", "ptype": "subscriber", "room": room, "feed": feed}}
    )
    print(response)
    # apply offer
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
    await recorder.start()

async def index(request):
    content = open(os.path.join(ROOT, "index.html"), "r").read()
    return web.Response(content_type="text/html", text=content)

async def javascript(request):
    content = open(os.path.join(ROOT, "index.js"), "r").read()
    return web.Response(content_type="application/javascript", text=content)

async def test(request):
    content = json.dumps("{'test':'test'}")
    return web.Response(content_type="application/json", text=content)

def getPeerList(request):
    
    output = []
    for e in id_list:
        output.append({
            "id": e,
            "name": name_dict[e]
        })
    
    content = json.dumps({
        "output": output
    })

    return web.Response(content_type="application/json", text=content)

async def clearAllConnection(request):

    id_list.clear()
    pc_dict.clear()
    video_track_dict.clear()
    audio_track_dict.clear()
    
    coros = [pc.close() for pc in pcs]
    await asyncio.gather(*coros)
    pcs.clear()

    content = json.dumps({'detail':'success'})
    return web.Response(content_type="application/json", text=content)

async def offer(request):
    params = await request.json()
    offer = RTCSessionDescription(sdp=params["sdp"], type=params["type"])

    try:
        id = params["id"]
    except:
        id = 'hololens'

    pc = RTCPeerConnection()

    if id == 'hololens' or id =="":
        pc_id = "Hololens(%s)" % uuid.uuid4()
    else:
        pc_id = "PeerConnection(%s)" % uuid.uuid4()
    
    print(id)
    
    pcs.add(pc)

    id_list.append(pc_id)
    pc_dict[pc_id] = pc

    def log_info(msg, *args):
        logger.info(pc_id + " " + msg, *args)

    log_info("Created for %s", request.remote)

    @pc.on("iceconnectionstatechange")
    async def on_iceconnectionstatechange():
        log_info("ICE connection state is %s", pc.iceConnectionState)
        if pc.iceConnectionState == "failed":
            await pc.close()
            pcs.discard(pc)

    @pc.on("track")
    def on_track(track):
        log_info("Track %s received", track.kind)

        # if len(pcs) > 1 and track.kind == "video":
        #     for e in id_list:
        #         pc.addTrack( pc_dict[e] )
        #         break

        if track.kind == "audio":
            # pc.addTrack(track)
            audio_track_dict[pc_id] = track
        elif track.kind == "video":
            # pc.addTrack(track)
            video_track_dict[pc_id] = track

        if id != "hololens" and id != "" and track.kind == "video":
            pc.addTrack(video_track_dict[id])
            pc.addTrack(audio_track_dict[id])
            
        @track.on("ended")
        async def on_ended():
            log_info("Track %s ended", track.kind)
            # await pc.close()

    # handle offer
    await pc.setRemoteDescription(offer)
    # await recorder.start()

    # send answer
    answer = await pc.createAnswer()
    await pc.setLocalDescription(answer)

    return web.Response(
        content_type="application/json",
        text=json.dumps(
            {"sdp": pc.localDescription.sdp, "type": pc.localDescription.type}
        ),
    )

# 
def channel_log(channel, t, message):
    print("channel(%s) %s %s" % (channel.label, t, message))

# not reflect now (for performance issue)
# track can only provide to one reader
# the reader will read frame in track
# If other reader wants to read it, it will get half of the frame
async def offer_reflect(request):
    params = await request.json()
    offer = RTCSessionDescription(sdp=params["sdp"], type=params["type"])

    try:
        id = params["id"]
    except:
        id = 'hololens'

    try:
        name = params['name']
    except:
        name = "visitor-(%s)" % uuid.uuid4()
    if not name:
        name = "visitor-(%s)" % uuid.uuid4()
    print('name: ', name)
    pc = RTCPeerConnection()

    if id == 'hololens' or id =="":
        pc_id = "Hololens(%s)" % uuid.uuid4()
    else:
        pc_id = "PeerConnection(%s)" % uuid.uuid4()
    
    # print(id)
    
    pcs.add(pc)

    id_list.append(pc_id)
    name_dict[pc_id] = name
    pc_dict[pc_id] = pc

    def log_info(msg, *args):
        logger.info(pc_id + " " + msg, *args)

    log_info("Created for %s", request.remote)

    @pc.on("iceconnectionstatechange")
    async def on_iceconnectionstatechange():
        log_info("ICE connection state is %s", pc.iceConnectionState)
        if pc.iceConnectionState == "failed":
            await pc.close()
            pcs.discard(pc)
        
    @pc.on("datachannel")
    def on_datachannel(channel):
        channel_log(channel, "-", "created by remote party")
        
        @channel.on("message")
        def on_message(message):
            channel_log(channel, "<", message)

    @pc.on("track")
    def on_track(track):
        log_info("Track %s received", track.kind)

        # if len(pcs) > 1 and track.kind == "video":
        #     for e in id_list:
        #         pc.addTrack( pc_dict[e] )
        #         break
        log_info("ready to extract track")
        if track.kind == "audio":
            log_info("add audio track")
            audio_track_dict[pc_id] = track
            # send back audio
            pc.addTrack(track)
        elif track.kind == "video":
            log_info("add video track")
            # pc.addTrack(track)
            video_track_dict[pc_id] = track

            local_video = VideoTransformTrack(
                track, transform="object-detection"
            )
            # video_track_dict[pc_id] = local_video
            pc.addTrack(local_video)
            
            # pc.addTrack(track)

        # if id != "hololens" and id != "" and track.kind == "video":
        #     log_info("hololens add video track")
        #     pc.addTrack(video_track_dict[pc_id])
        #     pc.addTrack(audio_track_dict[pc_id])
            
        @track.on("ended")
        async def on_ended():
            log_info("Track %s ended", track.kind)
            # await pc.close()

    # handle offer
    await pc.setRemoteDescription(offer)
    # await recorder.start()

    # send answer
    answer = await pc.createAnswer()
    await pc.setLocalDescription(answer)

    return web.Response(
        content_type="application/json",
        text=json.dumps(
            {"sdp": pc.localDescription.sdp, "type": pc.localDescription.type}
        ),
    )

async def subscribe_to_janus(request):

    roomId = -1
    feedId = -1

    try:
        roomId = request.query['roomId']
    except:
        return web.Response(
            content_type="application/json",
            text=json.dumps(
                {"error": "invalid roomId"}
            ),
        )
    
    try:
        feedId = request.query['feedId']
    except:
        return web.Response(
            content_type="application/json",
            text=json.dumps(
                {"error": "invalid roomId"}
            ),
        )
    roomId = int(roomId)
    feedId = int(feedId)
    # pc_id = "Hololens(%s)" % uuid.uuid4()
    pc_id = feedId
    
    # transaction = "aiortc-" + str(randint(0, 10000))

    # feedId to a session

    session = JanusSession(JANUS_SERVER)
    await session.create()
    plugin = await session.attach("janus.plugin.videoroom")

    recorder = MediaRecorder('/Users/hs/Documents/GitHub/aiortc-webrtc-server/server/file.mp4')

    await subscribe(session=session, room=roomId, feed=feedId, recorder=recorder, pc_id=pc_id)

    print("subscribe finish")
    print("publish video after object detection using ", pc_id)

    response = await plugin.send(
        {
            "body": {
                "display": "aiortc",
                "ptype": "publisher",
                "request": "join",
                "room": roomId,
            }
        }
    )
    publishers = response["plugindata"]["data"]["publishers"]
    for publisher in publishers:
        print("id: %(id)s, display: %(display)s" % publisher)

    await publish(plugin=plugin, pc_id=pc_id)

    return web.Response(
        content_type="application/json",
        text=json.dumps(
            {"message": "test"}
        ),
    )

async def aiortc_get_result(request):

    roomId = -1
    feedId = -1

    try:
        roomId = request.query['roomId']
    except:
        return web.Response(
            content_type="application/json",
            text=json.dumps(
                {"error": "invalid roomId"}
            ),
        )
    
    try:
        feedId = request.query['feedId']
    except:
        return web.Response(
            content_type="application/json",
            text=json.dumps(
                {"error": "invalid roomId"}
            ),
        )
    roomId = int(roomId)
    feedId = int(feedId)
    # pc_id = "Hololens(%s)" % uuid.uuid4()
    
    output = []
    temp_q = q
    while not temp_q.empty():
        output.append(temp_q.get())
    
    return web.Response(
        content_type="application/json",
        text=json.dumps(
            {"message": output}
        ),
    )
    

async def offer_receive_only(request):
    params = await request.json()
    offer = RTCSessionDescription(sdp=params["sdp"], type=params["type"])

    try:
        id = params["id"]
    except:
        id = 'hololens'

    pc = RTCPeerConnection()
    pcs.add(pc)

    pc.addTrack(audio_track_dict[id])
    pc.addTrack(video_track_dict[id])

    def log_info(msg, *args):
        logger.info(id + " " + msg, *args)

    log_info("Created for %s", request.remote)

    @pc.on("iceconnectionstatechange")
    async def on_iceconnectionstatechange():
        log_info("ICE connection state is %s", pc.iceConnectionState)
        if pc.iceConnectionState == "failed":
            await pc.close()
            pcs.discard(pc)

    @pc.on("track")
    def on_track(track):
        log_info("Track %s received", track.kind)

        log_info("ready to extract track")
        if track.kind == "audio":
            log_info("add audio track")
            # pc.addTrack(track)
        elif track.kind == "video":
            log_info("add video track")
            # pc.addTrack(track)
            
        @track.on("ended")
        async def on_ended():
            log_info("Track %s ended", track.kind)
            # await pc.close()

    # handle offer
    await pc.setRemoteDescription(offer)
    # for t in pc.getTransceivers():
    #     if t.kind == "audio":
    #         pc.addTrack(audio_track_dict[id])
    #     elif t.kind == "video":
    #         pc.addTrack(video_track_dict[id])
    # await recorder.start()

    # send answer
    answer = await pc.createAnswer()
    await pc.setLocalDescription(answer)

    return web.Response(
        content_type="application/json",
        text=json.dumps(
            {"sdp": pc.localDescription.sdp, "type": pc.localDescription.type}
        ),
    )

async def on_shutdown(app):
    # close peer connections
    coros = [pc.close() for pc in pcs]
    await asyncio.gather(*coros)
    pcs.clear()

if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="WebRTC audio / video / data-channels demo"
    )
    parser.add_argument("--cert-file", help="SSL certificate file (for HTTPS)")
    parser.add_argument("--key-file", help="SSL key file (for HTTPS)")
    parser.add_argument(
        "--host", default="0.0.0.0", help="Host for HTTP server (default: 0.0.0.0)"
    )
    parser.add_argument(
        "--port", type=int, default=8080, help="Port for HTTP server (default: 8080)"
    )
    parser.add_argument("--verbose", "-v", action="count")
    parser.add_argument("--write-audio", help="Write received audio to a file")
    args = parser.parse_args()

    if args.verbose:
        logging.basicConfig(level=logging.DEBUG)
    else:
        logging.basicConfig(level=logging.INFO)

    if args.cert_file:
        ssl_context = ssl.SSLContext()
        ssl_context.load_cert_chain(args.cert_file, args.key_file)
    else:
        ssl_context = None

    app = web.Application()
    app.on_shutdown.append(on_shutdown)

    # app.router.add_post("/offer", offer)
    # app.router.add_get("/test", test)

    cors = aiohttp_cors.setup(app)

    header = {
        "*":
            aiohttp_cors.ResourceOptions(
                allow_credentials=True,
            expose_headers=("X-Custom-Server-Header",),
            allow_headers=("X-Requested-With", "Content-Type"),
            max_age=3600,),
    }

    cors.add(app.router.add_get("/", index), header)
    cors.add(app.router.add_get('/index.js', javascript), header)
    cors.add(app.router.add_post("/offer", offer), header)
    cors.add(app.router.add_post("/offer_reflect", offer_reflect), header)

    cors.add(app.router.add_get("/subscribe_to_janus", subscribe_to_janus), header)
    cors.add(app.router.add_get("/aiortc-get-result", aiortc_get_result), header)

    cors.add(app.router.add_post("/offer_receive_only", offer_receive_only), header)
    cors.add(app.router.add_get("/test", test), header)
    cors.add(app.router.add_get("/getPeerList", getPeerList), header)
    cors.add(app.router.add_get("/clearAllConnection", clearAllConnection), header)

    web.run_app(
        app, access_log=None, host=args.host, port=args.port, ssl_context=ssl_context
    )
