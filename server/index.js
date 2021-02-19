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
    connectWebRTC();
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
let localStream;
let sendChannel;
const dataChannelOptions = { ordered: true };
// const remoteVideo = $('#remoteVideo');
const remoteVideo = document.querySelector("div#remote video");
// console.log(remoteVideo);

async function connectWebRTC() {

    // ---- video & audio ---- 
    // var mediaConstraints = {
    //     audio: true,            // We want an audio track
    //     video: true             // ...and we want a video track
    // };

    // const userMedia = await navigator.mediaDevices.getUserMedia(mediaConstraints);
    // localStream = userMedia;

    // const videoTracks = localStream.getVideoTracks();
    // const audioTracks = localStream.getAudioTracks();

    // if (videoTracks.length > 0) {
    //     console.log(`Using video device: ${videoTracks[0].label}`);
    // }

    // if (audioTracks.length > 0) {
    //     console.log(`Using audio device: ${audioTracks[0].label}`);
    // }

    var config = {
        sdpSemantics: 'unified-plan'
    };
    // need this to connect to other website
    config.iceServers = [{ urls: ['stun:stun.l.google.com:19302'] }];

    localPeerConnection = new RTCPeerConnection(config);
    console.log('initialize peer connection');
    localPeerConnection.onicecandidate = (e) =>
        onIceCandidate(localPeerConnection, e);
    localPeerConnection.ontrack = gotRemoteStream;
    localPeerConnection.onconnectionstatechange = (e) => onConnectionStateChange(e);

    // // ----- data channel -----
    // sendChannel = localPeerConnection.createDataChannel(
    //     "sendDataChannel",
    //     dataChannelOptions
    // );
    // sendChannel.onopen = onSendChannelStateChange;
    // sendChannel.onclose = onSendChannelStateChange;
    // sendChannel.onerror = onSendChannelStateChange;

    // localStream
    //     .getTracks()
    //     .forEach((track) => localPeerConnection.addTrack(track, localStream));

    console.log('start negotiate');
    negotiate();
}

const delay = (interval) => {
    return new Promise((resolve) => {
        setTimeout(resolve, interval);
    });
};

function onSendChannelStateChange() {
    const readyState = sendChannel.readyState;
    console.log(`Send channel state is: ${readyState}`);
    // if (readyState === "open") {
    //     sendDataLoop = setInterval(sendData, 1000);
    // } else {
    //     clearInterval(sendDataLoop);
    // }
}

async function onConnectionStateChange(event) {
    console.log('onConnectionStateChange: ', event);
    console.log('onconnectionstatechange: ', localPeerConnection.connectionState);
}

async function onIceCandidate(pc, event) {
    // try {
    //     onAddIceCandidateSuccess(pc);
    // } catch (e) {
    //     onAddIceCandidateError(pc, e);
    // }

    console.log(
        `$ ICE candidate:\n${event.candidate ? event.candidate.candidate : "(null)"
        }`
    );
}

function gotRemoteStream(e) {
    console.log('gotRemoteStream: ', e);
    if (remoteVideo.srcObject !== e.streams[0]) {
        remoteVideo.srcObject = e.streams[0];
        console.log("Received remote stream");
    }
    // if (remoteVideo.attr('src') !== e.streams[0]) {
    //     remoteVideo.attr('src', e.streams[0]);
    //     console.log("Received remote stream");
    // }

}

function negotiate() {
    // localPeerConnection.addTransceiver('video', { direction: 'recvonly' });
    // localPeerConnection.addTransceiver('audio', { direction: 'recvonly' });
    return localPeerConnection.createOffer({ "offerToReceiveAudio": true, "offerToReceiveVideo": true }).then(function (offer) {
        console.log('create offer: ', offer);
        return localPeerConnection.setLocalDescription(offer);
    }).then(function () {
        console.log('middle');
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
        console.log('done offer sdp: \n', localPeerConnection.localDescription.sdp);
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

