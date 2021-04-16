import * as common from "./common.js";
// var recording = document.getElementById("recorded_video");
var preview;
let remoteVideo;
let stream;
var isRecordingEnd = false;

export async function startRecording() {
  let downloadButton = document.getElementById("downloadButton");
  remoteVideo = document.getElementById("remotevideo1");
  console.log(`remoteVideo:${remoteVideo}`);
  let fps = 0;
  let recording = document.getElementById("recorded_video");

  if (remoteVideo.captureStream) {
    stream = remoteVideo.captureStream(fps);
  } else if (remoteVideo.mozCaptureStream) {
    stream = remoteVideo.mozCaptureStream(fps);
  } else {
    console.error("Stream capture is not supported");
    stream = null;
  }
  // recording.srcObject = stream;
  // mediaRecorder = new MediaRecorder(stream, {
  //   mimeType: "video/webm; codecs=vp9",
  // });
  let data = await start(stream);
  console.log(`data:${data}`);
  let recordedBlob = new Blob(data, { type: "video/webm" });
  //   recording.src = URL.createObjectURL(recordedBlob);
  //   downloadButton.href = recording.src;
  let blobUrl = URL.createObjectURL(recordedBlob);
  downloadButton.href = blobUrl;

  downloadButton.download = `RecordedVideo_${common.getDatetime()}.webm`;

  console.log(
    "Successfully recorded " + recordedBlob.size + " bytes of " + recordedBlob.type + " media."
  );
  isRecordingEnd = false;
  setTimeout(() => {
    downloadButton.click();
  }, 500);

  // navigator.mediaDevices
  //   .getUserMedia({
  //     video: true,
  //     audio: true,
  //   })
  //   .then((stream) => {
  //     preview = document.getElementById("remotevideo1");
  //     console.log(stream);
  //     preview.srcObject = stream;
  //     downloadButton.href = stream;
  //     preview.captureStream = preview.captureStream || preview.mozCaptureStream;
  //     return new Promise((resolve) => (preview.onplaying = resolve));
  //   })
  //   .then(() => start(preview.captureStream()))
  //   .then((recordedChunks) => {
  //     console.log("endvideo");
  //     let recordedBlob = new Blob(recordedChunks, { type: "video/webm" });
  //     //   recording.src = URL.createObjectURL(recordedBlob);
  //     //   downloadButton.href = recording.src;
  //     let blobUrl = URL.createObjectURL(recordedBlob);
  //     downloadButton.href = blobUrl;

  //     downloadButton.download = `RecordedVideo_${common.getDatetime()}.webm`;

  //     console.log(
  //       "Successfully recorded " + recordedBlob.size + " bytes of " + recordedBlob.type + " media."
  //     );
  //     isRecordingEnd = false;
  //     setTimeout(() => {
  //       downloadButton.click();
  //     }, 500);
  //   })
  //   .catch(console.log);
}

export async function stopRecording() {
  stop(stream);
  // stop(remoteVideo.srcObject);
}

async function start(stream) {
  let recorder;
  // 這樣下載後才看得到影片
  recorder = new MediaRecorder(stream, { mimeType: "video/webm; codecs=vp9" });
  let data = [];

  recorder.ondataavailable = (event) => data.push(event.data);
  recorder.start();
  console.log("recording start");

  await common.waitUntil(() => {
    return isRecordingEnd;
  }, 1000);
  // recorder.stop();
  // wait for the file to save
  await common.timeout(2000);
  // console.log(data);
  return data;
  //return Promise.all([stopped, recorded]).then(() => data);
}

function stop(stream) {
  stream.getTracks().forEach((track) => track.stop());
  console.log("stop recording");
  isRecordingEnd = true;
  //   downloadButton.click();
}
