const isProduction = true;

const CallingEnum = Object.freeze({
  none: 0,
  waiting: 1,
  online: 2,
  end: 3, //進到這階段，需要重新整理才能重call(按下close會重整)
});

const EndCallEnum = Object.freeze({
  self: 0,
  hmd: 1,
  timeout: 2,
});

// 由於object的reference固定不變，故在其他地方引用之後，仍可改變值
const status = {
  url: isProduction ? "adatea.sytes.net" : "ec2-18-181-179-94.ap-northeast-1.compute.amazonaws.com",
  online: {},
  currentHmd: {},
  callState: CallingEnum.none,
  isRecording: localStorage.getItem("isRecording") == "true" ? true : false,
  diplayName:
    localStorage.getItem("displayName") == null ? "EA-Demo" : localStorage.getItem("displayName"),
};
const urlExample =
  "http://ec2-18-181-179-94.ap-northeast-1.compute.amazonaws.com:5000/api/v1/online";

function setOnlineList(onlineList) {
  status.online = onlineList;
}

function setCurrentHmd(hmd) {
  status.currentHmd = hmd;
}
function setCallState(callState) {
  status.callState = callState;
}

function setIsRecording(isRecording) {
  status.isRecording = isRecording;
}

function setDisplayName(displayName) {
  status.displayName = displayName;
}

export {
  isProduction,
  status,
  CallingEnum,
  EndCallEnum,
  setOnlineList,
  setCurrentHmd,
  setCallState,
  setIsRecording,
  setDisplayName,
};
