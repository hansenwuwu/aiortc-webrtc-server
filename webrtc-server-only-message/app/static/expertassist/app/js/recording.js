import * as common from "./common.js";
// var recording = document.getElementById("recorded_video");
var remoteVideo;
var stream;
var isRecordingEnd = false;

export async function startRecording() {
  let downloadButton = document.getElementById("downloadButton");
  remoteVideo = document.getElementById("remotevideo1");
  console.log(`remoteVideo:${remoteVideo}`);
  let fps = 0;

  if (remoteVideo.captureStream) {
    stream = remoteVideo.captureStream(fps);
  } else if (remoteVideo.mozCaptureStream) {
    stream = remoteVideo.mozCaptureStream(fps);
  } else {
    console.error("Stream capture is not supported");
    stream = null;
  }
  let data = await start(stream);
  // After recording stopped
  console.log(`data:${data}`);
  let recordedBlob = new Blob(data, { type: "video/webm" });
  let blobUrl = URL.createObjectURL(recordedBlob);
  //   recording.src = URL.createObjectURL(recordedBlob);
  //   downloadButton.href = recording.src;
  downloadButton.href = blobUrl;
  downloadButton.download = `RecordedVideo_${common.getDatetime()}.webm`;

  console.log(
    "Successfully recorded " + recordedBlob.size + " bytes of " + recordedBlob.type + " media."
  );
  isRecordingEnd = false;
  setTimeout(() => {
    downloadButton.click();
  }, 500);
}

export async function stopRecording() {
  stop(stream);
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
