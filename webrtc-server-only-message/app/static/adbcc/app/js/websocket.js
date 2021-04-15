import { onWsMessage } from "./modules.js";
import { status } from "./manager.js";

const ws = new WebSocket(`ws://${status.url}/f/ws/adbcc/cc_001/ADBCC-hsinchu-01/0/0`);
ws.onopen = () => {
  console.log("open connection");
};

ws.onclose = () => {
  console.log("close connection");
};

//接收 Server 發送的訊息
ws.onmessage = (event) => {
  // console.log(event);
  let data;
  try {
    data = JSON.parse(event.data);
  } catch (error) {
    data = {
      value: {
        type : "error"
      }
    };
  }
  // console.log(data);
  onWsMessage(data);
};

export function sendCall(hmd, myid) {
  let data = {
    type: "message",
    receiver: hmd.id,
    value: {
      type: "call",
      value: "request",
      publishId: myid,
    },
  };
  ws.send(JSON.stringify(data));
}

export function sendEndCall(hmd) {
  let data = {
    type: "message",
    receiver: hmd.id,
    value: {
      type: "call",
      value: "hangup",
    },
  };
  console.log(data);
  ws.send(JSON.stringify(data));
}

export function sendAnswerCall(hmd, myid) {
  let data = {
    type: "message",
    receiver: hmd.id,
    value: {
      type: "call",
      value: "yes",
      publishId: myid,
    },
  };
  console.log(data);
  ws.send(JSON.stringify(data));
}

export function sendRejectCall(hmd) {
  let data = {
    type: "message",
    receiver: hmd.id,
    value: {
      type: "call",
      value: "no",
      publishId: "4590123722343314",
    },
  };
  console.log(data);
  ws.send(JSON.stringify(data));
}

export function sendMarkers(hmd, value) {
  let data = {
    type: "message",
    receiver: hmd.id,
    value: {
      type: "marker",
      value: value,
    },
  };
  console.log(data);
  ws.send(JSON.stringify(data));
}

// example of marker data
let marker_data_example = {
  value: {
    type: "marker",
    value: [
      {
        type: "arrow",
        color: "red",
        Lpos: {
          x: 537.0552995391705,
          y: 291.9770867430442,
        },
        Rpos: {
          x: 563,
          y: 318,
        },
      },
      {
        type: "square",
        color: "blue",
        Lpos: {
          x: 537.0552995391705,
          y: 291.9770867430442,
        },
        Rpos: {
          x: 563,
          y: 318,
        },
      },
    ],
  },
};

export function clearMarkers(hmd) {
  let data = {
    type: "message",
    receiver: hmd.id,
    value: {
      type: "marker",
      value: "empty",
    },
  };
  console.log(data);
  ws.send(JSON.stringify(data));
}

export function sendImage(hmd, value) {
  let data = {
    type: "message",
    receiver: hmd.id,
    value: {
      type: "image",
      value: value,
    },
  };
  console.log(data);
  ws.send(JSON.stringify(data));
}

export function clearImage(hmd) {
  let data = {
    type: "message",
    receiver: hmd.id,
    value: {
      type: "image",
      value: "empty",
    },
  };
  console.log(data);
  ws.send(JSON.stringify(data));
}
