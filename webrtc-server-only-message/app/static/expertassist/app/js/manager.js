const isProduction = true;

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

// 由於object的reference固定不變，故在其他地方引用之後，仍可改變值
const status = {
  url: isProduction ? "3.113.14.17":"ec2-18-181-179-94.ap-northeast-1.compute.amazonaws.com",
  online: {},
  currentHmd: {},
  callState: CallingEnum.none,
};
const urlExample = "http://ec2-18-181-179-94.ap-northeast-1.compute.amazonaws.com:5000/api/v1/online";



function setOnlineList(onlineList) {
  status.online = onlineList;
}

function setCurrentHmd(hmd) {
  status.currentHmd = hmd;
}
function setCallState(callState) {
  status.callState = callState;
}


export {
  isProduction,
  status,
  CallingEnum,
  EndCallEnum,
  setOnlineList,
  setCurrentHmd,
  setCallState,
};
