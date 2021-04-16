//----------------------- Useful Functions ---------------------------
// Run callBack after elementId exists
// function waitForElement(elementId, callBack) {
//     //console.log('Check Element');
//     return new Promise(function (resolve, reject) {
//       window.setTimeout(function () {
//         //console.log("test");
//         var element = document.getElementById(elementId);
//         if (element) {
//           callBack(elementId, element);
//           resolve();
//         } else {
//           waitForElement(elementId, callBack);
//         }
//       }, 100);
//     });
//   }

export async function waitUntil(condition, time) {
  return await new Promise((resolve) => {
    const interval = setInterval(() => {
      // console.log(`condition: ${condition()}`);
      if (condition()) {
        clearInterval(interval);
        resolve();
      }
    }, time);
  });
}

function waitToSetPost(elementId, hmdName, hmdIp, callBack) {
  console.log("Wait to set Element");
  return new Promise(function (resolve, reject) {
    window.setTimeout(function () {
      //console.log("test");
      var element = document.getElementById(elementId);
      if (element) {
        document.getElementById(elementId).onclick = null;
        document.getElementById(elementId).onclick = function () {
          console.log("set post " + elementId);
          callBack(hmdName, hmdIp);
          console.log(hmdName, hmdIp);
        };
        resolve();
      } else {
        waitToSetPost(elementId, hmdName, hmdIp, callBack);
      }
    }, 100);
  });
}

function waitToSetCommand(elementId, callBack) {
  console.log("Check Element");
  return new Promise(function (resolve, reject) {
    window.setTimeout(function () {
      //console.log("test");
      var element = document.getElementById(elementId);
      if (element) {
        document.getElementById(elementId).onclick = null;
        document.getElementById(elementId).onclick = function () {
          console.log("set command " + elementId);
          callBack();
        };
        resolve();
      } else {
        waitToSetCommand(elementId, callBack);
      }
    }, 100);
  });
}

export function pad(val) {
  return val > 9 ? val : "0" + val;
}

// Timeout for async await
function timeout(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Get List Object by ip
function getListObjectByIp(data, ip) {
  return data.filter(function (data) {
    return data.ip == ip;
  });
}
