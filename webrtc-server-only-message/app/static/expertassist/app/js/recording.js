import * as common from "./common.js";
// var recording = document.getElementById("recorded_video");
var combineStream;
var isRecordingEnd = false;

export async function startRecording() {
  let downloadButton = document.getElementById("downloadButton");
  const audioContext = new AudioContext();
  const fps = 0;

  // Get microphone audio stream
  let microphoneStream = await navigator.mediaDevices.getUserMedia({ audio: true });

  // Get remote video & audio stream
  let remoteVideo = document.getElementById("remotevideo1");
  let remoteStream;
  if (remoteVideo.captureStream) {
    remoteStream = remoteVideo.captureStream(fps);
  } else if (remoteVideo.mozCaptureStream) {
    remoteStream = remoteVideo.mozCaptureStream(fps);
  } else {
    console.error("Stream capture is not supported");
    remoteStream = null;
  }
  
  // combine two audio tracks into one track
  let micAudioSource = audioContext.createMediaStreamSource(microphoneStream)
  // console.log(`remoteStream.getTracks()[0] : ${remoteStream.getTracks()[0].kind}`)
  // console.log(`remoteStream.getTracks()[1] : ${remoteStream.getTracks()[1].kind}`)
  let remoteAudioSource = audioContext.createMediaStreamSource(remoteStream)
  let dest = audioContext.createMediaStreamDestination()
  micAudioSource.connect(dest)
  remoteAudioSource.connect(dest)

  // combine audio and video stream together
  combineStream = await record(
    new MediaStream([dest.stream.getAudioTracks()[0], remoteStream.getVideoTracks()[0]])
  )

  // After recording stopped
  console.log(`combineStream:${combineStream}`);
  let recordedBlob = new Blob(combineStream, { type: "video/webm" });
  let blobUrl = URL.createObjectURL(recordedBlob);
  downloadButton.href = blobUrl;
  downloadButton.download = `RecordedVideo_${common.getDatetime()}.webm`;
  console.log(
    "Successfully recorded " + recordedBlob.size + " bytes of " + recordedBlob.type + " media."
  );
  isRecordingEnd = false;
  // start downloading
  setTimeout(() => {
    downloadButton.click();
  }, 500);
}

export async function stopRecording() {
  stop(combineStream);
}

async function record(stream) {
  // set the format to download
  let recorder = new MediaRecorder(stream, { mimeType: "video/webm; codecs=vp9" });
  let data = [];

  recorder.ondataavailable = (event) => data.push(event.data);
  recorder.start();
  console.log("recording start");

  // After sending back isRecordingEnd == true, stop ther recorder
  await common.waitUntil(() => {
    return isRecordingEnd;
  }, 1000);
  recorder.stop();
  // wait for the file to save
  await common.timeout(2000);
  return data;
  //return Promise.all([stopped, recorded]).then(() => data);
}

function stop(stream) {
  // stream.getTracks().forEach((track) => track.stop());
  console.log("stop recording");
  isRecordingEnd = true;
}
