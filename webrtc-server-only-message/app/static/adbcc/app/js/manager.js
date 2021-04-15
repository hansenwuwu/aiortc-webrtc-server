// 由於object的reference固定不變，故在其他地方引用之後，仍可改變值
const CallingEnum = Object.freeze({
  none: 0,
  waiting: 1,
  online: 2,
});

const EndCallEnum = Object.freeze({
  self: 0,
  hmd: 1,
  timeout: 2,
});

const urlExample = "http://ec2-18-181-179-94.ap-northeast-1.compute.amazonaws.com:5000/api/v1/online";

const status = {
  // url: "ec2-18-181-179-94.ap-northeast-1.compute.amazonaws.com",
  url: "3.113.14.17",
  online: {},
  currentHmd: {},
  callState: CallingEnum.none,
  janusState: "",
};

function setOnlineList(onlineList) {
  status.online = onlineList;
}

function setCurrentHmd(hmd) {
  status.currentHmd = hmd;
}
function setCallState(callState) {
  status.callState = callState;
}

function setJanusState(state) {
  status.janusState = state;
}


export {
  status,
  CallingEnum,
  EndCallEnum,
  setOnlineList,
  setCurrentHmd,
  setCallState,
  setJanusState,
};
