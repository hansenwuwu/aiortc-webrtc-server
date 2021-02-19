import argparse
import asyncio
import json
import logging
import os
import ssl
import uuid

import cv2
import numpy as np
from aiohttp import web
from av import VideoFrame

from aiortc import RTCPeerConnection, RTCSessionDescription, MediaStreamTrack
from aiortc.contrib.media import MediaBlackhole, MediaPlayer, MediaRecorder

import aiohttp_cors

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
                self.count = 1
                img = frame.to_ndarray(format="bgr24")
                
                blob = cv2.dnn.blobFromImage(img, 1/255, (whT,whT), [0,0,0], 1, crop=False)
                net.setInput(blob)

                layerNames = net.getLayerNames()
                outputNames = [ layerNames[i[0]-1] for i in net.getUnconnectedOutLayers() ]
                outputs = net.forward(outputNames)

                indices, bbox, classIds, confs = findObjects(outputs, img)

                for i in indices:
                    i = i[0]
                    box = bbox[i]
                    x, y, w, h = box[0], box[1], box[2], box[3]
                    cv2.rectangle(img, (x,y), (x+w, y+h), (255, 0, 255), 2)
                    cv2.putText(img, f'{classNames[classIds[i]].upper()} {int(confs[i]*100)}%', 
                        (x, y-10), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255,0,255), 2)
                    print(f'{classNames[classIds[i]].upper()} {int(confs[i]*100)}% (x, y, w, h) = ({x}, {y}, {w}, {h})')
                
                new_frame = VideoFrame.from_ndarray(img, format="bgr24")
                new_frame.pts = frame.pts
                new_frame.time_base = frame.time_base

                return new_frame
            else:
                self.count = 0
                return frame
        else:
            return frame


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
    cors.add(app.router.add_post("/offer_receive_only", offer_receive_only), header)
    cors.add(app.router.add_get("/test", test), header)
    cors.add(app.router.add_get("/getPeerList", getPeerList), header)
    cors.add(app.router.add_get("/clearAllConnection", clearAllConnection), header)

    web.run_app(
        app, access_log=None, host=args.host, port=args.port, ssl_context=ssl_context
    )
