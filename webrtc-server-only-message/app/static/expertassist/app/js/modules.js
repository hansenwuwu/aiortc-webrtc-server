import {
  isProduction,
  status,
  CallingEnum,
  EndCallEnum,
  setOnlineList,
  setCurrentHmd,
  setCallState,
  setIsRecording
} from "./manager.js";
import {
  connectJanus,
  getMyId,
  newRemoteFeed,
  destroyJanus,
  getIsVideoReady,
  setIsVideoReady,
} from "./janus_videoroom.js";
import { sendCall, sendEndCall, sendAnswerCall, sendRejectCall } from "./websocket.js";
import { showToolbox, hideToolbox } from "./draw.js";
import * as common from "./common.js";

import * as api from "./api.js";
import { startRecording, stopRecording } from "./recording.js";

var callTimeout; // 當啟動calling，會自動計算是否timeout
var timer; // 顯示目前通話秒數
const FooterType = Object.freeze({
  init: 0,
  waiting: 1,
  online: 2,
  empty: 3,
  declined: 4,
  timeout: 5,
});
var routinelyUpdateOnlineListFunc;

// ------------- private functions -------------
// onlineList Footer
function _setFooterSwitch(hmd, callState) {
  function _setInitFooter() {
    document.getElementById("hmd_list_card_foot").style.backgroundColor = "#233E58";
    document.getElementById("hmd_list_card_foot").innerHTML = `
    <div class="row">
      <div class="col-12 text-center mt-4">
          <i class="fas fa-circle fa-xs mr-2" style="transform: translate(0px, -2px);color: #8BFFA1;"></i>
          <p class="p-calling-hmd">${hmd.display_name}</p>
      </div>
      <div class="col-12 text-center mt-5">
          <button class="btn btn-expert font-weight-bold" id="call_btn">Call</button>
      </div>
    </div>`;
  }
  function _setWaitingFooter() {
    document.getElementById("hmd_list_card_foot").innerHTML = `<div class="row">
    <div class="col-12 text-center mt-4">
        <i class="fas fa-circle fa-xs mr-2"
            style="transform: translate(0px, -2px);color: #8BFFA1;"></i>
        <p class="p-calling-hmd">${hmd.display_name}</p>
        <p class="p-calling-animation">Calling</p>
        <div class="lds-ellipsis">
            <div></div>
            <div></div>
            <div></div>
            <div></div>
        </div>
    </div>
    <div class="col-12 text-center" style="margin-top:-3px;">
        <button class="btn btn-reject-call font-weight-bold" id="calling_cancel_btn">Cancel</button>
    </div>
    </div>`;
  }
  function _setOnlineFooter() {
    document.getElementById("hmd_list_card_foot").style.backgroundColor = "#233E58";
    document.getElementById("hmd_list_card_foot").innerHTML = `<div class="row">
        <div class="col-12 text-center mt-4">
            <i class="fas fa-circle fa-xs mr-2"
                style="transform: translate(0px, -2px);color: #8BFFA1;"></i>
            <p class="p-calling-hmd">${hmd.display_name}</p>
            <p class="p-calling-time"><span id="minutes">00</span>:<span id="seconds">00</span></p>
          
        </div>
        <div class="col-12 text-center" style="margin-top:-2px;">
          <button class="btn btn-reject-call font-weight-bold" id="end_call_btn">End Call</button>
        </div>
      </div>`;
  }
  function _setEmptyFooter() {
    document.getElementById("hmd_list_card_foot").style.backgroundColor = "white";
    document.getElementById("hmd_list_card_foot").innerHTML = "";
  }
  function _setDeclinedFooter() {
    document.getElementById("hmd_list_card_foot").style.backgroundColor = "#233E58";
    document.getElementById("hmd_list_card_foot").innerHTML = `<div class="row">
      <div class="col-12 text-center mt-4">
          <i class="fas fa-circle fa-xs mr-2"
              style="transform: translate(0px, -2px);color: #8BFFA1;"></i>
          <p class="p-calling-hmd">${hmd.display_name}</p>
          <p class="p-calling-warning">Declined</p>
        
      </div>
      <div class="col-12 text-center mt-1">
          <button class="btn btn-outline-blue font-weight-bold float-left" style="margin-left:2vw" id="close_call_btn">Close</button>
          <button class="btn btn-expert font-weight-bold float-right"  style="margin-right:2vw"id="call_btn">Redial</button>
      </div>
    </div>`;
  }
  function _setTimeoutFooter() {
    document.getElementById("hmd_list_card_foot").innerHTML = `<div class="row">
    <div class="col-12 text-center mt-4">
        <i class="fas fa-circle fa-xs mr-2"
            style="transform: translate(0px, -2px);color: #8BFFA1;"></i>
        <p class="p-calling-hmd">${hmd.display_name}</p>
        <p class="p-calling-warning">No Response</p>
      
    </div>
    <div class="col-12 text-center mt-1">
        <button class="btn btn-outline-blue font-weight-bold float-left" style="margin-left:2vw" id="close_call_btn">Close</button>
        <button class="btn btn-expert font-weight-bold float-right"  style="margin-right:2vw"id="call_btn">Redial</button>
    </div>
  </div>`;
  }
  var footerMap = {
    0: _setInitFooter,
    1: _setWaitingFooter,
    2: _setOnlineFooter,
    3: _setEmptyFooter,
    4: _setDeclinedFooter,
    5: _setTimeoutFooter,
  };
  return footerMap[callState]();
}
async function _handleCallBtnOnClick(hmd) {
  // draw calling loading
  document.getElementById("call_btn").onclick = async function () {
    setCallState(CallingEnum.waiting);
    console.log("call");
    hmd.isCalling = true;
    _setFooterSwitch(hmd, FooterType.waiting);
    // janus connection
    connectJanus();
    await common.waitUntil(() => {
      return getMyId() == null ? false : true;
    }, 200);
    let myid = getMyId();
    console.log(`myid:${myid}`);
    if (myid != "-1") {
      sendCall(hmd, myid);
    }

    // setTimeout(() => {
    //   let myid = getMyId();
    //   console.log(`myid:${myid}`);
    //   sendCall(hmd, myid);
    // }, 3000);

    // button handle
    document.getElementById("calling_cancel_btn").onclick = async function () {
      console.log("觸發endCall, 取消通話");
      endCall(EndCallEnum.self);
    };
    callTimeout = setTimeout(() => {
      endCall(EndCallEnum.timeout);
      console.log("觸發endCall, 無回應");
    }, 15000);
  };
}

function _clearCalling() {
  console.log("clear calling");

  clearInterval(timer);
  clearTimeout(callTimeout);
  setCallState(CallingEnum.none);
  // setCurrentHmd({});
  hideToolbox();
  for (let i in status.online) {
    $("#hmd_" + status.online[i].id).removeClass("active");
  }
  handleOnlineListOnClick(status.online, status.callState);
  document.getElementById("ADAT_bg").removeAttribute("hidden");
}

function _startCallState() {
  console.log("進入通話階段");
  setCallState(CallingEnum.online);
  clearTimeout(callTimeout);
  clearInterval(timer);
}

async function _enterCall(hmd) {
  console.log("正式開始通話");
  // prevent the user from reject the call if HMD answered
  setTimeout(() => {
    document.getElementById("ADAT_bg").setAttribute("hidden", "");
    showToolbox();
    _setFooterSwitch(hmd, FooterType.online);
    // Timer start to count
    var sec = 0;
    timer = setInterval(function () {
      document.getElementById("seconds").innerHTML = common.pad(++sec % 60);
      document.getElementById("minutes").innerHTML = common.pad(parseInt(sec / 60, 10));
    }, 1000);

    document.getElementById("end_call_btn").onclick = async function () {
      console.log("觸發endCall, 自行掛斷");
      endCall(EndCallEnum.self);
    };
  }, 500);

  // get remote video
  newRemoteFeed(hmd.publish_id);
  if (status.isRecording) {
    // wait for video ready to start recording
    await common.waitUntil(() => {
      return getIsVideoReady();
    }, 300);
    setTimeout(() => {
      startRecording();
    }, 500);
    setIsVideoReady(false);
  }
}

function _setIncomingCallModal(hmd) {
  function _handleAnswerBtnOnClick() {
    document.getElementById("confirm_incoming_btn").onclick = async function () {
      // 改變設定，避免timeout
      setCurrentHmd(hmd);
      _startCallState();

      connectJanus();
      // _showLoading();
      _showIncomingCallLoading();
      await common.waitUntil(() => {
        return getMyId() == null ? false : true;
      }, 200);
      // 進入通話
      let myid = getMyId();
      console.log(`myid:${myid}`);
      sendAnswerCall(hmd, myid);
      _enterCall(hmd);
      // hide modal
      $("#modal_incoming_call").modal("hide");
      _hideIncomingCallLoading();
    };
  }
  function _handleAnswerNo() {
    document.getElementById("reject_incoming_btn").onclick = function () {
      console.log("觸發endCall, 拒接來電");
      sendRejectCall(hmd);
      // endCall(EndCallEnum.self);
    };
  }

  document.getElementById(
    "incoming_title"
  ).innerHTML = `<a class="font-weight-bold">${hmd.display_name}</a>`;

  $("#modal_incoming_call").modal({
    backdrop: "static",
  });
  // handle onclick
  _handleAnswerBtnOnClick();
  _handleAnswerNo();
}

function _checkCurrentHmdOnline(onlineList, hmd) {
  if (onlineList == []) return false;
  else {
    let index = onlineList.findIndex((x) => x.display_name == hmd.display_name);
    if (index == -1) return false;
    else return true;
  }
}

function _showIncomingCallLoading() {
  let rejectIncomingBtn = document.getElementById("reject_incoming_btn");
  rejectIncomingBtn.disabled = true;
  let confirmIncomingBtn = document.getElementById("confirm_incoming_btn");
  confirmIncomingBtn.disabled = true;
  // confirmIncomingBtn.innerHTML = `
  // <img id="call_answer_img" src="../static/image/call_answer.png" style="height:19px">
  // <span class="spinner-border spinner-border-sm ml-2" role="status" aria-hidden="true" style="height:19px"></span>
  // `
}
function _hideIncomingCallLoading() {
  let rejectIncomingBtn = document.getElementById("reject_incoming_btn");
  rejectIncomingBtn.disabled = false;
  let confirmIncomingBtn = document.getElementById("confirm_incoming_btn");
  confirmIncomingBtn.disabled = false;
  // confirmIncomingBtn.innerHTML = `
  // <img id="call_answer_img" src="../static/image/call_answer.png" style="height:19px">
  // `
}

// 整個頁面的loading
function _showLoading() {
  document.getElementById("loading-spinner").style.display = "block";
}
function _hideLoading() {
  document.getElementById("loading-spinner").style.display = "none";
}

// ------------- public functions -------------
// draw the online list
export function drawOnlineList(onlineList) {
  document.getElementById("hmd_list_card_body").innerHTML = "";
  for (let i in onlineList) {
    var onlineListCardBody = document.getElementById("hmd_list_card_body");
    let onlineListCardBodyInnerHtml = `
      <div class="row online-row">
        <div class="col-12">
          <button class="btn btn-onlineList btn-block text-left" 
          id="hmd_${onlineList[i].id}" style="">
          <div style="transform: translateY(0px)">
          <i class="fas fa-circle fa-xs ml-2 mr-3" style="color: #8BFFA1;"></i>
            ${onlineList[i].display_name}
        </div>
      </div>`;
    onlineListCardBody.innerHTML += onlineListCardBodyInnerHtml;
  }
}

// setup the click function of Online List
export function handleOnlineListOnClick(onlineList, callState) {
  for (let i in onlineList) {
    // remove onclick
    $("#hmd_" + onlineList[i].id)
      .prop("onclick", "tr", null)
      .off("click");

    document.getElementById("hmd_" + onlineList[i].id).onclick = function () {
      // Highlight the selected list and hide the others
      for (let i in onlineList) {
        $("#hmd_" + onlineList[i].id).removeClass("active");
      }
      $(this).toggleClass("active");
      // 只有目前未和其他人通話中，點擊才可觸發
      if (callState == CallingEnum.none) {
        setCurrentHmd(onlineList[i]);
        // show call area
        _setFooterSwitch(onlineList[i], FooterType.init);
        _handleCallBtnOnClick(onlineList[i]);
      }
    };
  }
}

export async function endCall(endCallState) {
  // Destroy Janus (暫時先不管什麼情況都destroy)
  try {
    destroyJanus();
  } catch (error) {
    console.log(error);
  }

  if (status.callState == CallingEnum.online) {
    // Endcall loading
    let endCallBtn = document.getElementById("end_call_btn");
    endCallBtn.disabled = true;
    endCallBtn.innerHTML = `
    End Call
    <span class="spinner-border spinner-border-sm ml-2" role="status" aria-hidden="true"></span>
    `;
    // stop recording
    if (status.isRecording) {
      try {
        stopRecording();
      } catch (error) {
        console.log(error);
      }
    }
  } else if (status.callState == CallingEnum.waiting) {
    let callingCancelBtn = document.getElementById("calling_cancel_btn");
    callingCancelBtn.disabled = true;
    callingCancelBtn.innerHTML = `
    Cancel
    <span class="spinner-border spinner-border-sm ml-2" role="status" aria-hidden="true"></span>
    `;
  } 

  // 等待Janus Destroy完成
  await common.waitUntil(() => {
    console.log(`isJanusEnd:${isJanusEnd}`);
    return isJanusEnd;
  }, 500);
  isJanusEnd = false; //重置janus.js中的變數 (但在janus成功重新連接時，依然需要重置一次)

  // 未撥打時，List中直接消失
  if (status.callState == CallingEnum.none && endCallState == EndCallEnum.hmd) {
    console.log("未撥打時，List中直接消失");
    _setFooterSwitch("", FooterType.empty);
    setCurrentHmd({});
  }
  // 等待接聽時，自行取消通話 - Empty
  else if (status.callState == CallingEnum.waiting && endCallState == EndCallEnum.self) {
    console.log("等待接聽時，自行取消通話");
    _setFooterSwitch("", FooterType.empty);
    sendEndCall(status.currentHmd);
    setCurrentHmd({});
  }
  // 等待接聽時，被掛斷 - Declined
  else if (status.callState == CallingEnum.waiting && endCallState == EndCallEnum.hmd) {
    console.log("等待接聽時，被掛斷");
    console.log(status);
    // setMyId("-1");

    _setFooterSwitch(status.currentHmd, FooterType.declined);
    document.getElementById("close_call_btn").onclick = function () {
      _setFooterSwitch("", FooterType.empty);
      _clearCalling();
    };
    // $("#modal_incoming_call").modal("hide");
    _handleCallBtnOnClick(status.currentHmd);
  }
  // 等待接聽時，Timeout - No Response
  else if (status.callState == CallingEnum.waiting && endCallState == EndCallEnum.timeout) {
    console.log("等待接聽時，Timeout");
    _setFooterSwitch(status.currentHmd, FooterType.timeout);
    sendEndCall(status.currentHmd);
    document.getElementById("close_call_btn").onclick = function () {
      _setFooterSwitch("", FooterType.empty);
      _clearCalling();
    };
    // setMyId("-1");
    _handleCallBtnOnClick(status.currentHmd);
  }
  //通話中，自行掛斷 - Clear
  else if (status.callState == CallingEnum.online && endCallState == EndCallEnum.self) {
    console.log("通話中，自行掛斷");
    _setFooterSwitch("", FooterType.empty);
    sendEndCall(status.currentHmd);
    setCurrentHmd({});
  }
  // 通話中，被掛斷 - Declined
  else if (status.callState == CallingEnum.online && endCallState == EndCallEnum.hmd) {
    console.log("通話中，被掛斷");
    _setFooterSwitch(status.currentHmd, FooterType.declined);
    document.getElementById("close_call_btn").onclick = function () {
      _setFooterSwitch("", FooterType.empty);
      _clearCalling();
    };
    // $("#modal_incoming_call").modal("hide");
    _handleCallBtnOnClick(status.currentHmd);
  }
  //其餘所有狀況 (切換頁面、來電拒接...等) - Empty
  else {
    console.log("其他掛斷狀況");
    sendEndCall(status.currentHmd);
    _setFooterSwitch("", FooterType.empty);
  }
  // 清空通話中資訊，UI調整
  _clearCalling();

  // 直接重整(不須Destroy janus)
  // setTimeout(() => {
  //   location.reload();
  // }, 100);
}

// handle Message get from websocket
export async function onWsMessage(data) {
  function _handleAnswerYes() {
    console.log("get yes");
    let hmd = {
      id: data.sender_id,
      display_name: data.sender_name,
      publish_id: parseInt(data.value.publishId),
    };
    let callingCancelBtn = document.getElementById("calling_cancel_btn");
    callingCancelBtn.disabled = true;
    callingCancelBtn.innerHTML = `
    Cancel
    <span class="spinner-border spinner-border-sm ml-2" role="status" aria-hidden="true"></span>
    `;
    _startCallState();
    _enterCall(hmd);
  }
  async function _handleAnswerNo() {
    console.log("get no");
    endCall(EndCallEnum.hmd);
  }
  async function _handleHangUp() {
    console.log("觸發endCall，收到HMD端'No'，結束通話");
    endCall(EndCallEnum.hmd);
  }
  function _handleIncomingCall() {
    // console.log(data)
    let hmd = {
      id: data.sender_id,
      display_name: data.sender_name,
      publish_id: parseInt(data.value.publishId),
    };
    _setIncomingCallModal(hmd);
  }
  function _handleDefault() {
    return 0;
  }

  //--------- function main ------
  console.log(data);
  let type = 0;
  if (data.value.type == "call") {
    if (status.callState != CallingEnum.online) {
      if (data.value.value == "request") {
        type = 4;
      }
    }
    if (status.callState == CallingEnum.waiting) {
      if (data.value.value == "yes") type = 1;
      else if (data.value.value == "no") type = 2;
    } else if (status.callState == CallingEnum.online) {
      if (data.value.value == "hangup") type = 3;
    } else {
      // Hide incoming call modal
      $("#modal_incoming_call").modal("hide");
    }
  } else {
    type = 0;
  }
  var msgMap = {
    0: _handleDefault,
    1: _handleAnswerYes,
    2: _handleAnswerNo,
    3: _handleHangUp,
    4: _handleIncomingCall,
  };
  return msgMap[type]();
}

// get the online list routinely
export async function routinelyUpdateOnlineList() {
  // clear timeout every time
  clearTimeout(routinelyUpdateOnlineListFunc);

  let onlineURL = isProduction
    ? `https://${status.url}/f/api/v1/online`
    : `http://${status.url}:5000/api/v1/online`;
  let newOnlineList = await api.getOnlineList(onlineURL);
  // If the json file is updated, update the online list
  if (JSON.stringify(newOnlineList) != JSON.stringify(status.online)) {
    setOnlineList(newOnlineList);
    console.log(status.online);
    drawOnlineList(status.online);
    setTimeout(() => {
      handleOnlineListOnClick(status.online, status.callState);
    }, 300);
    //處理通話中的HMD突然下線
    let isOnline = _checkCurrentHmdOnline(status.online, status.currentHmd);
    if (!isOnline) {
      if (status.callState != CallingEnum.none) endCall(EndCallEnum.hmd);
      else _clearCalling();
    }
  }
  routinelyUpdateOnlineListFunc = setTimeout(routinelyUpdateOnlineList, 1000);
}

export function handleSettingBtnOnclick() {
  let recordCheck = document.getElementById("record_check");
  if (localStorage.getItem("isRecording") == 'true') {
    recordCheck.checked = true;
  } 
  else if (localStorage.getItem("isRecording") == 'false') {
    recordCheck.checked = false;
  }
  else recordCheck.checked = false;

  setIsRecording(recordCheck.checked);

  recordCheck.onclick = function () {
    if (this.checked) {
      console.log("isRecording set to true");
      setIsRecording(true)
      localStorage.setItem("isRecording", true);
    } else {
      console.log("isRecording set to false");
      setIsRecording(false)
      localStorage.setItem("isRecording", false);
    }
  };
 

  document.getElementById("setting_btn").onclick = function () {
    $("#modal_setting").modal("toggle");
  };
}
