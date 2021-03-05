from aiortc import MediaStreamTrack
import time
import cv2
import numpy as np
from av import VideoFrame
import queue

whT = 320

classesFile = '../server/yolo/coco.names'
classNames = []
with open(classesFile, 'rt') as f:
    classNames = f.read().rstrip('\n').split('\n')

modelConfiguration = '../server/yolo/yolov3-tiny.cfg'
modelWeights = '../server/yolo/yolov3-tiny.weights'

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

'''
    Saving detect data
'''
ObjectDetectionResult = {}

class VideoTransformTrack(MediaStreamTrack):
    """
    A video stream track that transforms frames from an another track.
    """

    kind = "video"

    def __init__(self, track, transform, peerId):
        super().__init__()  # don't forget this!
        self.peerId = peerId
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
                print(self.peerId, ' - detecting')
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

                if str(self.peerId) not in ObjectDetectionResult:
                    print('init')
                    ObjectDetectionResult[str(self.peerId)] = queue.Queue(maxsize=10)
                else:
                    if ObjectDetectionResult[str(self.peerId)].full():
                        temp = ObjectDetectionResult[str(self.peerId)].get()
                    ObjectDetectionResult[str(self.peerId)].put(result_list)
                    # print(result_list)
                
                return new_frame
            else:
                self.count += 1
                if self.count == 2:
                    self.count = 0
                return frame
        else:
            return frame

'''
    get ai results by peerId
    todo:
        - check peer connection of aiortc
        
'''
def RetrieveResults(peerId):
    if str(peerId) not in ObjectDetectionResult:
        # check is peer connected
        return False
        
    output = []
    tempQueue = ObjectDetectionResult[str(peerId)]
    while not tempQueue.empty():
        output.append(tempQueue.get())
    ObjectDetectionResult[str(peerId)].queue.clear()

    return output