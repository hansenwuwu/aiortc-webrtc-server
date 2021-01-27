const refreshButton = $('#refreshButton');
const connectButton = $('#connectButton');
const selectConnection = $('#selectConnection');
const serverIPText = $('#serverIP');
const changeButton = $('#changeButton');

SERVERIP = "http://" + serverIPText.val() + ":8080";

refreshButton.on('click', refresh);
connectButton.on('click', connect);
// changeButton.on('click', changeButtonOnclick);
serverIPText.change(function () {
    SERVERIP = "http://" + serverIPText.val() + ":8080";
    console.log('serverIP: ', SERVERIP);
});

// function changeButtonOnclick() {
//     console.log('serverIP: ', serverIPText.val());
// }

async function connect() {

    if (selectConnection.val() == "-1") {
        alert('please select a peer');
        return;
    }

    console.log('connect value: ', selectConnection.val());

}

async function refresh() {

    var startTime = Date.now();

    refreshButton.prop('disabled', true);
    connectButton.prop('disabled', true);
    selectConnection.prop('disabled', true);

    await $.get((SERVERIP + "/getPeerList"), function (data) {
        console.log(data.output);
        selectConnection.empty().append('<option selected="selected" value="-1">Select peer to connect</option>');

        for (var i = 0; i < data.output.length; i++) {
            // console.log(data.output[i].id);
            // console.log(data.output[i].name);
            selectConnection.append($('<option>', {
                value: data.output[i].id,
                text: data.output[i].name
            }));
        }

    }).fail(function () {
        alert("error");
    });

    console.log('total time: ', (Date.now() - startTime));
    refreshButton.prop('disabled', false);
    connectButton.prop('disabled', false);
    selectConnection.prop('disabled', false);

}

// webrtc part
let localPeerConnection;
const remoteVideo = $('#remoteVideo');

async function connectWebRTC() {
    localPeerConnection = new RTCPeerConnection();
    console.log('initialize peer connection');
    localPeerConnection.onicecandidate = (e) =>
        onIceCandidate(localPeerConnection, e);
    localPeerConnection.ontrack = gotRemoteStream;
    localPeerConnection.onconnectionstatechange = function (event) {
        console.log('onconnectionstatechange: ', localPeerConnection.connectionState);
        switch (localPeerConnection.connectionState) {
            case "connected":
                // The connection has become fully connected
                break;
            case "disconnected":
            case "failed":
                // One or more transports has terminated unexpectedly or in an error
                break;
            case "closed":
                // The connection has been closed
                break;
        }
    }

    console.log('start negotiate');

    await negotiate();

}

async function onIceCandidate(pc, event) {
    // try {
    //     onAddIceCandidateSuccess(pc);
    // } catch (e) {
    //     onAddIceCandidateError(pc, e);
    // }

    console.log(
        `${getName(pc)} ICE candidate:\n${event.candidate ? event.candidate.candidate : "(null)"
        }`
    );
}

function gotRemoteStream(e) {
    console.log('gotRemoteStream: ', e);
    if (remoteVideo.srcObject !== e.streams[0]) {
        remoteVideo.srcObject = e.streams[0];
        console.log("Received remote stream");
    }
}

function negotiate() {
    return localPeerConnection.createOffer().then(function (offer) {
        return localPeerConnection.setLocalDescription(offer);
    }).then(function () {
        // wait for ICE gathering to complete
        return new Promise(function (resolve) {
            if (localPeerConnection.iceGatheringState === 'complete') {
                resolve();
            } else {
                function checkState() {
                    if (localPeerConnection.iceGatheringState === 'complete') {
                        localPeerConnection.removeEventListener('icegatheringstatechange', checkState);
                        resolve();
                    }
                }
                localPeerConnection.addEventListener('icegatheringstatechange', checkState);
            }
        });
    }).then(function () {
        console.log(localPeerConnection.localDescription.sdp);
        var offer = localPeerConnection.localDescription;

        return fetch((SERVERIP + '/offer_receive_only'), {
            body: JSON.stringify({
                sdp: offer.sdp,
                type: offer.type,
                id: selectConnection.val()
            }),
            headers: {
                'Content-Type': 'application/json'
            },
            method: 'POST'
        });

    }).then(function (response) {
        return response.json();
    }).then(function (answer) {
        console.log('setRemoteDescription: ', answer);
        return localPeerConnection.setRemoteDescription(answer);
    }).catch(function (e) {
        alert(e);
    });
}
