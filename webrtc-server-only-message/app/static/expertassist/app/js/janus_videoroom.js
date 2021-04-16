import { isProduction, status } from "./manager.js";

var janusServer = isProduction
  ? `https://${status.url}/j/janus`
  : `http://${status.url}:8088/janus`;

var janus = null;
var janus_roomList = null;
var sfutest = null;
var opaqueId = "videoroomtest-" + Janus.randomString(12);

var myroom = 5566; // Demo room
if (getQueryStringValue("room") !== "") myroom = parseInt(getQueryStringValue("room"));
var roomList = [];
var currentRoomId = -1;
var currentRoomDescription = "";

var myusername = null;
var myid = null;
// We use this other ID just to map our subscriptions to us
var mypvtid = null;
var webrtcUp = false;
var audioenabled = false;
var mystream = null;
var feeds = [];
var bitrateTimer = [];

var doSimulcast =
  getQueryStringValue("simulcast") === "yes" || getQueryStringValue("simulcast") === "true";
var doSimulcast2 =
  getQueryStringValue("simulcast2") === "yes" || getQueryStringValue("simulcast2") === "true";
var acodec = getQueryStringValue("acodec") !== "" ? getQueryStringValue("acodec") : null;
var vcodec = getQueryStringValue("vcodec") !== "" ? getQueryStringValue("vcodec") : null;
var subscriber_mode =
  getQueryStringValue("subscriber-mode") === "yes" ||
  getQueryStringValue("subscriber-mode") === "true";
// subscriber_mode = true;

var feeds = [];

export function getMyId() {
  return myid;
}
export function setMyId(id) {
  let myid = id;
}

export function destroyJanus() {
  if (janus != null) janus.destroy();
}

export function connectJanus() {
  Janus.init({
    debug: "all",
    callback: function () {
      // Use a button to start the demo
      // $(this).attr("disabled", true).unbind("click");
      // Make sure the browser supports WebRTC
      if (!Janus.isWebrtcSupported()) {
        console.log("No WebRTC support... ");
        return;
      }
      // Create session
      janus = new Janus({
        server: janusServer,
        success: function () {
          // Attach to AudioBridge plugin
          janus.attach({
            plugin: "janus.plugin.videoroom",
            opaqueId: opaqueId,
            success: function (pluginHandle) {
              // $('#details').remove();
              sfutest = pluginHandle;
              Janus.log(
                "Plugin attached! (" + sfutest.getPlugin() + ", id=" + sfutest.getId() + ")"
              );
              Janus.log("  -- This is a publisher/manager");
              // First, check the Room list to get the room id
              setTimeout(() => {
                var register = {
                  request: "join",
                  room: 5566,
                  ptype: "publisher",
                  display: "CC-Demo",
                };
                // myusername = username;
                console.log(myroom);
                sfutest.send({ message: register });
              }, 1000);

              //   var register = { request: "list" };
              //   sfutest.send({
              // message: register,
              // success: function (result) {
              //   if (!result) {
              //     console.log("error!");
              //     resolve();
              //     return;
              //   }
              //   if (result["list"]) {
              //     roomList = result["list"];
              //     console.log(roomList);
              //     // default room
              //     if (roomList.length > 0) {
              //       currentRoomId = roomList[0].room;
              //       currentRoomDescription = roomList[i].description;
              //     }
              //     for (let i = 0; i < roomList.length; i++) {
              //       if (roomList[i].description == currentHmd.name) {
              //         currentRoomId = roomList[i].room;
              //         currentRoomDescription = roomList[i].description;
              //       }
              //     }
              //     // After getting the needed information, joining the room
              //     var username = "test-cc";
              //     myroom = 5566;
              //     // myroom = parseInt(currentRoomId);
              //     myusername = username;
              //     // var register = { request: "list" };
              //     var register = {
              //       request: "join",
              //       room: myroom,
              //       ptype: "publisher",
              //       display: username,
              //     };
              //     myusername = username;
              //     console.log(myroom);
              //     sfutest.send({ message: register });
              //   }
              // },
              //   });

              // $('#username').focus();
              $("#start")
                .removeAttr("disabled")
                .html("Stop")
                .click(function () {
                  $(this).attr("disabled", true);
                  janus.destroy();
                });
            },
            error: function (error) {
              Janus.error("  -- Error attaching plugin...", error);
            },
            consentDialog: function (on) {
              Janus.debug("Consent dialog should be " + (on ? "on" : "off") + " now");
              // if(on) {
              // 	// Darken screen and show hint
              // 	$.blockUI({
              // 		message: '<div><img src="up_arrow.png"/></div>',
              // 		css: {
              // 			border: 'none',
              // 			padding: '15px',
              // 			backgroundColor: 'transparent',
              // 			color: '#aaa',
              // 			top: '10px',
              // 			left: (navigator.mozGetUserMedia ? '-100px' : '300px')
              // 		} });
              // } else {
              // 	// Restore screen
              // 	$.unblockUI();
              // }
            },
            iceState: function (state) {
              if (state=="disconnected")  isJanusEnd = true;
              Janus.log("ICE state changed to " + state);
            },
            mediaState: function (medium, on) {
              Janus.log("Janus " + (on ? "started" : "stopped") + " receiving our " + medium);
            },
            webrtcState: function (on) {
              Janus.log("Janus says our WebRTC PeerConnection is " + (on ? "up" : "down") + " now");
              $("#videolocal").parent().parent().unblock();
              if (!on) return;
              $("#publish").remove();
              // This controls allows us to override the global room bitrate cap
              $("#bitrate").parent().parent().removeClass("hide").show();
              $("#bitrate a").click(function () {
                var id = $(this).attr("id");
                var bitrate = parseInt(id) * 1000;
                if (bitrate === 0) {
                  Janus.log("Not limiting bandwidth via REMB");
                } else {
                  Janus.log("Capping bandwidth to " + bitrate + " via REMB");
                }
                $("#bitrateset")
                  .html($(this).html() + '<span class="caret"></span>')
                  .parent()
                  .removeClass("open");
                sfutest.send({ message: { request: "configure", bitrate: bitrate } });
                return false;
              });
            },
            onmessage: function (msg, jsep) {
              Janus.debug(" ::: Got a message :::", msg);
              var event = msg["videoroom"];
              Janus.debug("Event: " + event);
              if (event) {
                if (event === "joined") {
                  // Successfully joined, negotiate WebRTC now
                  //   if (msg["id"]) {
                  //     myid = msg["private_id"];
                  //     Janus.log("Successfully joined room " + msg["room"] + " with ID " + myid);
                  //     if (!webrtcUp) {
                  //       webrtcUp = true;
                  //       // Publish our stream
                  //       sfutest.createOffer({
                  //         media: { video: false }, // This is an audio only room
                  //         success: function (jsep) {
                  //           Janus.debug("Got SDP!", jsep);
                  //           var publish = {
                  //             request: "configure",
                  //             muted: false,
                  //           };
                  //           sfutest.send({ message: publish, jsep: jsep });
                  //         },
                  //         error: function (error) {
                  //           Janus.error("WebRTC error:", error);
                  //         },
                  //       });
                  //     }
                  //   }
                  //   // Any room participant?
                  //   if (msg["participants"]) {
                  //     var list = msg["participants"];
                  //     Janus.debug("Got a list of participants:", list);
                  //     for (var f in list) {
                  //       var id = list[f]["id"];
                  //       var display = list[f]["display"];
                  //       var setup = list[f]["setup"];
                  //       var muted = list[f]["muted"];
                  //       Janus.debug(
                  //         "  >> [" +
                  //           id +
                  //           "] " +
                  //           display +
                  //           " (setup=" +
                  //           setup +
                  //           ", muted=" +
                  //           muted +
                  //           ")"
                  //       );
                  //       if ($("#rp" + id).length === 0) {
                  //         // Add to the participants list
                  //         // $("#list").append(
                  //         //   '<li id="rp' +
                  //         //     id +
                  //         //     '" class="list-group-item">' +
                  //         //     display +
                  //         //     ' <i class="absetup fa fa-chain-broken"></i>' +
                  //         //     ' <i class="abmuted fa fa-microphone-slash"></i></li>'
                  //         // );
                  //         $("#rp" + id + " > i").hide();
                  //       }
                  //       if (muted === true || muted === "true")
                  //         $("#rp" + id + " > i.abmuted")
                  //           .removeClass("hide")
                  //           .show();
                  //       else $("#rp" + id + " > i.abmuted").hide();
                  //       if (setup === true || setup === "true") $("#rp" + id + " > i.absetup").hide();
                  //       else
                  //         $("#rp" + id + " > i.absetup")
                  //           .removeClass("hide")
                  //           .show();
                  //     }
                  //   }
                  // Publisher/manager created, negotiate WebRTC and attach to existing feeds, if any
                  myid = msg["id"]; // publish id
                  mypvtid = msg["private_id"];
                  Janus.log("Successfully joined room " + msg["room"] + " with ID " + myid);

                  if (subscriber_mode) {
                    $("#videojoin").hide();
                    $("#videos").removeClass("hide").show();
                  } else {
                    publishOwnFeed(true);
                    // only publish audio
                  }
                  // Any new feed to attach to?
                  if (msg["publishers"]) {
                    var list = msg["publishers"];
                    Janus.debug("Got a list of available publishers/feeds:", list);
                    for (var f in list) {
                      var id = list[f]["id"];
                      var display = list[f]["display"];
                      var audio = list[f]["audio_codec"];
                      var video = list[f]["video_codec"];
                      Janus.debug(
                        "  >> [" +
                          id +
                          "] " +
                          display +
                          " (audio: " +
                          audio +
                          ", video: " +
                          video +
                          ")"
                      );
                      //   newRemoteFeed(id, display, audio, video);
                      // setTimeout(() => {
                      //   console.log(`video:${video}`)
                      //   newRemoteFeed(id, display, audio, video);
                      // }, 10000);
                    }
                  }
                } else if (event === "roomchanged") {
                  // The user switched to a different room
                  myid = msg["id"];
                  Janus.log("Moved to room " + msg["room"] + ", new ID: " + myid);
                  // Any room participant?
                  // $("#list").empty();
                  if (msg["participants"]) {
                    var list = msg["participants"];
                    Janus.debug("Got a list of participants:", list);
                    for (var f in list) {
                      var id = list[f]["id"];
                      var display = list[f]["display"];
                      var setup = list[f]["setup"];
                      var muted = list[f]["muted"];
                      Janus.debug(
                        "  >> [" +
                          id +
                          "] " +
                          display +
                          " (setup=" +
                          setup +
                          ", muted=" +
                          muted +
                          ")"
                      );
                      if ($("#rp" + id).length === 0) {
                        // Add to the participants list
                        // $("#list").append(
                        //   '<li id="rp' +
                        //     id +
                        //     '" class="list-group-item">' +
                        //     display +
                        //     ' <i class="absetup fa fa-chain-broken"></i>' +
                        //     ' <i class="abmuted fa fa-microphone-slash"></i></li>'
                        // );
                        $("#rp" + id + " > i").hide();
                      }
                      if (muted === true || muted === "true")
                        $("#rp" + id + " > i.abmuted")
                          .removeClass("hide")
                          .show();
                      else $("#rp" + id + " > i.abmuted").hide();
                      if (setup === true || setup === "true") $("#rp" + id + " > i.absetup").hide();
                      else
                        $("#rp" + id + " > i.absetup")
                          .removeClass("hide")
                          .show();
                    }
                  }
                } else if (event === "destroyed") {
                  // The room has been destroyed
                  Janus.warn("The room has been destroyed!");
                } else if (event === "event") {
                  // Any new feed to attach to?
                  if (msg["publishers"]) {
                    var list = msg["publishers"];
                    Janus.debug("Got a list of available publishers/feeds:", list);
                    for (var f in list) {
                      var id = list[f]["id"];
                      var display = list[f]["display"];
                      var audio = list[f]["audio_codec"];
                      var video = list[f]["video_codec"];
                      Janus.debug(
                        "  >> [" +
                          id +
                          "] " +
                          display +
                          " (audio: " +
                          audio +
                          ", video: " +
                          video +
                          ")"
                      );
                      //   newRemoteFeed(id, display, audio, video);
                    }
                  } else if (msg["leaving"]) {
                    // One of the publishers has gone away?
                    var leaving = msg["leaving"];
                    Janus.log("Publisher left: " + leaving);
                    var remoteFeed = null;
                    for (var i = 1; i < 6; i++) {
                      if (feeds[i] && feeds[i].rfid == leaving) {
                        remoteFeed = feeds[i];
                        break;
                      }
                    }
                    if (remoteFeed != null) {
                      Janus.debug(
                        "Feed " +
                          remoteFeed.rfid +
                          " (" +
                          remoteFeed.rfdisplay +
                          ") has left the room, detaching"
                      );
                      $("#remote1").empty().hide();
                      $("#videoremote1").empty();
                      console.log(`remoteFeed.rfindex: ${remoteFeed.rfindex}`);
                      feeds[remoteFeed.rfindex] = null;
                      remoteFeed.detach();
                    }
                  } else if (msg["unpublished"]) {
                    // One of the publishers has unpublished?
                    var unpublished = msg["unpublished"];
                    Janus.log("Publisher left: " + unpublished);
                    if (unpublished === "ok") {
                      // That's us
                      sfutest.hangup();
                      return;
                    }
                    var remoteFeed = null;
                    for (var i = 1; i < 6; i++) {
                      if (feeds[i] && feeds[i].rfid == unpublished) {
                        remoteFeed = feeds[i];
                        break;
                      }
                    }
                    if (remoteFeed != null) {
                      Janus.debug(
                        "Feed " +
                          remoteFeed.rfid +
                          " (" +
                          remoteFeed.rfdisplay +
                          ") has left the room, detaching"
                      );
                      $("#remote1").empty().hide();
                      $("#videoremote1").empty();
                      feeds[remoteFeed.rfindex] = null;
                      remoteFeed.detach();
                    }
                  } else if (msg["error"]) {
                    if (msg["error_code"] === 426) {
                      // This is a "no such room" error: give a more meaningful description
                      bootbox.alert(
                        "<p>Apparently room <code>" +
                          myroom +
                          "</code> (the one this demo uses as a test room) " +
                          "does not exist...</p><p>Do you have an updated <code>janus.plugin.videoroom.jcfg</code> " +
                          "configuration file? If not, make sure you copy the details of room <code>" +
                          myroom +
                          "</code> " +
                          "from that sample in your current configuration file, then restart Janus and try again."
                      );
                    } else {
                      bootbox.alert(msg["error"]);
                    }
                  }

                  //   if (msg["participants"]) {
                  //     var list = msg["participants"];
                  //     Janus.debug("Got a list of participants:", list);
                  //     for (var f in list) {
                  //       var id = list[f]["id"];
                  //       var display = list[f]["display"];
                  //       var setup = list[f]["setup"];
                  //       var muted = list[f]["muted"];
                  //       Janus.debug(
                  //         "  >> [" +
                  //           id +
                  //           "] " +
                  //           display +
                  //           " (setup=" +
                  //           setup +
                  //           ", muted=" +
                  //           muted +
                  //           ")"
                  //       );
                  //       if ($("#rp" + id).length === 0) {
                  //         // Add to the participants list
                  //         // $("#list").append(
                  //         //   '<li id="rp' +
                  //         //     id +
                  //         //     '" class="list-group-item">' +
                  //         //     display +
                  //         //     ' <i class="absetup fa fa-chain-broken"></i>' +
                  //         //     ' <i class="abmuted fa fa-microphone-slash"></i></li>'
                  //         // );
                  //         $("#rp" + id + " > i").hide();
                  //       }
                  //       if (muted === true || muted === "true")
                  //         $("#rp" + id + " > i.abmuted")
                  //           .removeClass("hide")
                  //           .show();
                  //       else $("#rp" + id + " > i.abmuted").hide();
                  //       if (setup === true || setup === "true") $("#rp" + id + " > i.absetup").hide();
                  //       else
                  //         $("#rp" + id + " > i.absetup")
                  //           .removeClass("hide")
                  //           .show();
                  //     }
                  //   } else if (msg["error"]) {
                  //     if (msg["error_code"] === 485) {
                  //       // This is a "no such room" error: give a more meaningful description
                  //       console.log(
                  //         "<p>Apparently room <code>" +
                  //           myroom +
                  //           "</code> (the one this demo uses as a test room) " +
                  //           "does not exist...</p><p>Do you have an updated <code>janus.plugin.audiobridge.jcfg</code> " +
                  //           "configuration file? If not, make sure you copy the details of room <code>" +
                  //           myroom +
                  //           "</code> " +
                  //           "from that sample in your current configuration file, then restart Janus and try again."
                  //       );
                  //     } else {
                  //       console.log(msg["error"]);
                  //     }
                  //     return;
                  //   }
                  //   // Any new feed to attach to?
                  //   if (msg["leaving"]) {
                  //     // One of the participants has gone away?
                  //     var leaving = msg["leaving"];
                  //     Janus.log(
                  //       "Participant left: " +
                  //         leaving +
                  //         " (we have " +
                  //         $("#rp" + leaving).length +
                  //         " elements with ID #rp" +
                  //         leaving +
                  //         ")"
                  //     );
                  //     $("#rp" + leaving).remove();
                  //   }
                }
              }
              if (jsep) {
                Janus.debug("Handling SDP as well...", jsep);
                sfutest.handleRemoteJsep({ jsep: jsep });
                // Check if any of the media we wanted to publish has
                // been rejected (e.g., wrong or unsupported codec)
                var audio = msg["audio_codec"];
                if (
                  mystream &&
                  mystream.getAudioTracks() &&
                  mystream.getAudioTracks().length > 0 &&
                  !audio
                ) {
                  // Audio has been rejected
                  toastr.warning("Our audio stream has been rejected, viewers won't hear us");
                }
                var video = msg["video_codec"];
                if (
                  mystream &&
                  mystream.getVideoTracks() &&
                  mystream.getVideoTracks().length > 0 &&
                  !video
                ) {
                  // Video has been rejected
                  toastr.warning("Our video stream has been rejected, viewers won't see us");
                  // Hide the webcam video
                  $("#myvideo").hide();
                  $("#videolocal").append(
                    '<div class="no-video-container">' +
                      '<i class="fa fa-video-camera fa-5 no-video-icon" style="height: 100%;"></i>' +
                      '<span class="no-video-text" style="font-size: 16px;">Video rejected, no webcam</span>' +
                      "</div>"
                  );
                }
              }
            },
            onlocalstream: function (stream) {
              Janus.debug(" ::: Got a local stream :::", stream);
              // We're not going to attach the local audio stream
              // $("#audiojoin").hide();
              // $("#room").removeClass("hide").show();
              // $("#participant").removeClass("hide").html(myusername).show();
              mystream = stream;
              $("#videojoin").hide();
              $("#videos").removeClass("hide").show();
              if ($("#myvideo").length === 0) {
                $("#videolocal").append(
                  '<video class="rounded centered" id="myvideo" width="100%" height="100%" autoplay playsinline muted="muted"/>'
                );
                // Add a 'mute' button
                $("#videolocal").append(
                  '<button class="btn btn-warning btn-xs" id="mute" style="position: absolute; bottom: 0px; left: 0px; margin: 15px;">Mute</button>'
                );
                // $("#mute").click(toggleMute);
                // Add an 'unpublish' button
                $("#videolocal").append(
                  '<button class="btn btn-warning btn-xs" id="unpublish" style="position: absolute; bottom: 0px; right: 0px; margin: 15px;">Unpublish</button>'
                );
                $("#unpublish").click(unpublishOwnFeed);
              }
              $("#publisher").removeClass("hide").html(myusername).show();
              //   Janus.attachMediaStream($("#myvideo").get(0), stream); //放自己畫面
              //   $("#myvideo").get(0).muted = "muted";
              if (
                sfutest.webrtcStuff.pc.iceConnectionState !== "completed" &&
                sfutest.webrtcStuff.pc.iceConnectionState !== "connected"
              ) {
                $("#videolocal")
                  .parent()
                  .parent()
                  .block({
                    message: "<b>Publishing...</b>",
                    css: {
                      border: "none",
                      backgroundColor: "transparent",
                      color: "white",
                    },
                  });
              }
              var videoTracks = stream.getVideoTracks();
              if (!videoTracks || videoTracks.length === 0) {
                // No webcam
                $("#myvideo").hide();
                if ($("#videolocal .no-video-container").length === 0) {
                  $("#videolocal").append(
                    '<div class="no-video-container">' +
                      '<i class="fa fa-video-camera fa-5 no-video-icon"></i>' +
                      '<span class="no-video-text">No webcam available</span>' +
                      "</div>"
                  );
                }
              } else {
                $("#videolocal .no-video-container").remove();
                $("#myvideo").removeClass("hide").show();
              }
            },
            onremotestream: function (stream) {
              // $("#room").removeClass("hide").show();
              //   var addButtons = false;
              //   if ($("#roomaudio").length === 0) {
              //     addButtons = true;
              //     $("#mixedaudio").append(
              //       '<audio class="rounded centered" id="roomaudio" width="100%" height="100%" autoplay/>'
              //     );
              //   }
              //   Janus.attachMediaStream($("#roomaudio").get(0), stream);
              //   if (!addButtons) return;
              // Mute button
              //   audioenabled = true;
              // $("#toggleaudio")
              //   .click(function () {
              //     audioenabled = !audioenabled;
              //     if (audioenabled)
              //       $("#toggleaudio")
              //         .html("Mute")
              //         .removeClass("btn-success")
              //         .addClass("btn-danger");
              //     else
              //       $("#toggleaudio")
              //         .html("Unmute")
              //         .removeClass("btn-danger")
              //         .addClass("btn-success");
              //     sfutest.send({
              //       message: { request: "configure", muted: !audioenabled },
              //     });
              //   })
              //   .removeClass("hide")
              //   .show();
            },
            oncleanup: function () {
              webrtcUp = false;
              Janus.log(" ::: Got a cleanup notification: we are unpublished now :::");
              // $("#participant").empty().hide();
              // $("#list").empty();
              $("#mixedaudio").empty();
              // $("#room").hide();

              mystream = null;
              $("#videolocal").html(
                '<button id="publish" class="btn btn-primary">Publish</button>'
              );
              $("#publish").click(function () {
                publishOwnFeed(true);
              });
              $("#videolocal").parent().parent().unblock();
              $("#bitrate").parent().parent().addClass("hide");
              $("#bitrate a").unbind("click");
            },
          });
        },
        error: function (error) {
          Janus.error(error);
          webrtcUp = false;
        },
        //自己destroy
        destroyed: function () {
          console.log("reload");
          webrtcUp = false;
          myid = null;
          // isJanusEnd = true;
          // window.location.reload();
        },
      });
    },
  });
}

function publishOwnFeed(useAudio) {
  // Publish our stream
  $("#publish").attr("disabled", true).unbind("click");
  sfutest.createOffer({
    // Add data:true here if you want to publish datachannels as well
    media: { audioRecv: false, videoRecv: false, audioSend: useAudio, videoSend: false }, // Publishers are sendonly
    // If you want to test simulcasting (Chrome and Firefox only), then
    // pass a ?simulcast=true when opening this demo page: it will turn
    // the following 'simulcast' property to pass to janus.js to true
    simulcast: doSimulcast,
    simulcast2: doSimulcast2,
    success: function (jsep) {
      Janus.debug("Got publisher SDP!", jsep);
      var publish = { request: "configure", audio: useAudio, video: false };
      // You can force a specific codec to use when publishing by using the
      // audiocodec and videocodec properties, for instance:
      // 		publish["audiocodec"] = "opus"
      // to force Opus as the audio codec to use, or:
      // 		publish["videocodec"] = "vp9"
      // to force VP9 as the videocodec to use. In both case, though, forcing
      // a codec will only work if: (1) the codec is actually in the SDP (and
      // so the browser supports it), and (2) the codec is in the list of
      // allowed codecs in a room. With respect to the point (2) above,
      // refer to the text in janus.plugin.videoroom.jcfg for more details.
      // We allow people to specify a codec via query string, for demo purposes
      if (acodec) publish["audiocodec"] = acodec;
      if (vcodec) publish["videocodec"] = vcodec;
      sfutest.send({ message: publish, jsep: jsep });
    },
    error: function (error) {
      Janus.error("WebRTC error:", error);
      if (useAudio) {
        publishOwnFeed(false);
      } else {
        bootbox.alert("WebRTC error... " + error.message);
        $("#publish")
          .removeAttr("disabled")
          .click(function () {
            publishOwnFeed(true);
          });
      }
    },
  });
}

function unpublishOwnFeed() {
  // Unpublish our stream
  $("#unpublish").attr("disabled", true).unbind("click");
  var unpublish = { request: "unpublish" };
  sfutest.send({ message: unpublish });
}

// 去拉HMD的影像聲音
export function newRemoteFeed(id, display, audio, video) {
  // A new feed has been published, create a new plugin handle and attach to it as a subscriber
  var remoteFeed = null;
  janus.attach({
    plugin: "janus.plugin.videoroom",
    opaqueId: opaqueId,
    success: function (pluginHandle) {
      remoteFeed = pluginHandle;
      remoteFeed.simulcastStarted = false;
      Janus.log("Plugin attached! (" + remoteFeed.getPlugin() + ", id=" + remoteFeed.getId() + ")");
      Janus.log("  -- This is a subscriber");
      // We wait for the plugin to send us an offer
      var subscribe = {
        request: "join",
        room: myroom,
        ptype: "subscriber",
        feed: id,
        // private_id: mypvtid,
      };
      // In case you don't want to receive audio, video or data, even if the
      // publisher is sending them, set the 'offer_audio', 'offer_video' or
      // 'offer_data' properties to false (they're true by default), e.g.:
      // 		subscribe["offer_video"] = false;
      // For example, if the publisher is VP8 and this is Safari, let's avoid video
      // if (
      //   Janus.webRTCAdapter.browserDetails.browser === "safari" &&
      //   (video === "vp9" || (video === "vp8" && !Janus.safariVp8))
      // ) {
      //   if (video) video = video.toUpperCase();
      //   toastr.warning(
      //     "Publisher is using " + video + ", but Safari doesn't support it: disabling video"
      //   );
      //   subscribe["offer_video"] = false;
      // }
      // remoteFeed.videoCodec = video;
      remoteFeed.send({ message: subscribe });
    },
    error: function (error) {
      Janus.error("  -- Error attaching plugin...", error);
      bootbox.alert("Error attaching plugin... " + error);
    },
    onmessage: function (msg, jsep) {
      Janus.debug(" ::: Got a message (subscriber) :::", msg);
      var event = msg["videoroom"];
      Janus.debug("Event: " + event);
      if (msg["error"]) {
        bootbox.alert(msg["error"]);
      } else if (event) {
        if (event === "attached") {
          // Subscriber created and attached
          for (var i = 1; i < 6; i++) {
            if (!feeds[i]) {
              feeds[i] = remoteFeed;
              remoteFeed.rfindex = i;
              break;
            }
          }
          remoteFeed.rfid = msg["id"];
          remoteFeed.rfdisplay = msg["display"];
          if (!remoteFeed.spinner) {
            var target = document.getElementById("videoremote1");
            remoteFeed.spinner = new Spinner({ top: 100 }).spin(target);
          } else {
            remoteFeed.spinner.spin();
          }
          Janus.log(
            "Successfully attached to feed " +
              remoteFeed.rfid +
              " (" +
              remoteFeed.rfdisplay +
              ") in room " +
              msg["room"]
          );
          $("#remote1").removeClass("hide").html(remoteFeed.rfdisplay).show();
        } else if (event === "event") {
          // Check if we got a simulcast-related event from this publisher
          var substream = msg["substream"];
          var temporal = msg["temporal"];
          if (
            (substream !== null && substream !== undefined) ||
            (temporal !== null && temporal !== undefined)
          ) {
            if (!remoteFeed.simulcastStarted) {
              remoteFeed.simulcastStarted = true;
              // Add some new buttons
              addSimulcastButtons(
                remoteFeed.rfindex,
                remoteFeed.videoCodec === "vp8" || remoteFeed.videoCodec === "h264"
              );
            }
            // We just received notice that there's been a switch, update the buttons
            updateSimulcastButtons(remoteFeed.rfindex, substream, temporal);
          }
        } else {
          // What has just happened?
        }
      }
      if (jsep) {
        Janus.debug("Handling SDP as well...", jsep);
        // Answer and attach
        remoteFeed.createAnswer({
          jsep: jsep,
          // Add data:true here if you want to subscribe to datachannels as well
          // (obviously only works if the publisher offered them in the first place)
          media: { audioSend: false, videoSend: false }, // We want recvonly audio/video
          success: function (jsep) {
            Janus.debug("Got SDP!", jsep);
            var body = { request: "start", room: myroom };
            remoteFeed.send({ message: body, jsep: jsep });
          },
          error: function (error) {
            Janus.error("WebRTC error:", error);
            bootbox.alert("WebRTC error... " + error.message);
          },
        });
      }
    },
    iceState: function (state) {
      Janus.log(
        "ICE state of this WebRTC PeerConnection (feed #" +
          remoteFeed.rfindex +
          ") changed to " +
          state
      );
    },
    webrtcState: function (on) {
      if (on) isJanusEnd = false;
      Janus.log(
        "Janus says this WebRTC PeerConnection (feed #" +
          remoteFeed.rfindex +
          ") is " +
          (on ? "up" : "down") +
          " now"
      );
    },
    onlocalstream: function (stream) {
      // The subscriber stream is recvonly, we don't expect anything here
    },
    onremotestream: function (stream) {
      Janus.debug("Remote feed #1" + ", stream:", stream);
      var addButtons = false;
      //   if ($("#remotevideo1").length === 0) {
      addButtons = true;
      // No remote video yet
      $("#videoremote1").append(
        '<video class="rounded centered" id="waitingvideo1' + '" width="100%" height="100%" />'
      );
      $("#videoremote1").append(
        '<video class="rounded centered relative hide" id="remotevideo1' +
          '" width="100%" height="100%" autoplay playsinline/>'
      );
      // $("#videoremote1").append(
      //   '<span class="label label-primary hide" id="curres1' +
      //     '" style="position: absolute; bottom: 0px; left: 0px; margin: 15px;"></span>'
      // );
      // Show the video, hide the spinner and show the resolution when we get a playing event
      $("#remotevideo1").bind("playing", function () {
        if (remoteFeed.spinner) remoteFeed.spinner.stop();
        remoteFeed.spinner = null;
        $("#waitingvideo1").remove();
        if (this.videoWidth) $("#remotevideo1").removeClass("hide").show();
        var width = this.videoWidth;
        var height = this.videoHeight;
        // $("#curres1")
        //   .removeClass("hide")
        //   .text(width + "x" + height)
        //   .show();
        if (Janus.webRTCAdapter.browserDetails.browser === "firefox") {
          // Firefox Stable has a bug: width and height are not immediately available after a playing
          setTimeout(function () {
            var width = $("#remotevideo1").get(0).videoWidth;
            var height = $("#remotevideo1").get(0).videoHeight;
            // $("#curres1")
            //   .removeClass("hide")
            //   .text(width + "x" + height)
            //   .show();
          }, 2000);
        }
      });
      //   }
      Janus.attachMediaStream($("#remotevideo1").get(0), stream);
      var videoTracks = stream.getVideoTracks();
      if (!videoTracks || videoTracks.length === 0) {
        // No remote video
        $("#remotevideo1").hide();
        if ($("#videoremote1" + " .no-video-container").length === 0) {
          $("#videoremote1").append(
            '<div class="no-video-container">' +
              '<i class="fa fa-video-camera fa-5 no-video-icon"></i>' +
              '<span class="no-video-text">No remote video available</span>' +
              "</div>"
          );
        }
      } else {
        $("#videoremote1" + " .no-video-container").remove();
        $("#remotevideo1").removeClass("hide").show();
      }
      if (!addButtons) return;
      if (
        Janus.webRTCAdapter.browserDetails.browser === "chrome" ||
        Janus.webRTCAdapter.browserDetails.browser === "firefox" ||
        Janus.webRTCAdapter.browserDetails.browser === "safari"
      ) {
        // $("#curbitrate1")
        //   .removeClass("hide")
        //   .show();
        // bitrateTimer[remoteFeed.rfindex] = setInterval(function () {
        // Display updated bitrate, if supported
        // var bitrate = remoteFeed.getBitrate();
        // $("#curbitrate1").text(bitrate);
        // Check if the resolution changed too
        // var width = $("#remotevideo1").get(0).videoWidth;
        // var height = $("#remotevideo1").get(0).videoHeight;
        // if (width > 0 && height > 0)
        //   $("#curres1")
        //     .removeClass("hide")
        //     .text(width + "x" + height)
        //     .show();
        // }, 1000);
      }
    },
    oncleanup: function () {
      Janus.log(" ::: Got a cleanup notification (remote feed " + id + ") :::");
      if (remoteFeed.spinner) remoteFeed.spinner.stop();
      remoteFeed.spinner = null;
      $("#remotevideo1").remove();
      $("#waitingvideo1").remove();
      $("#novideo1").remove();
      // $("#curbitrate1").remove();
      // $("#curres1").remove();
      if (bitrateTimer[remoteFeed.rfindex]) clearInterval(bitrateTimer[remoteFeed.rfindex]);
      bitrateTimer[remoteFeed.rfindex] = null;
      remoteFeed.simulcastStarted = false;
      $("#simulcast1").remove();
    },
  });
}

// Helper to parse query string
function getQueryStringValue(name) {
  name = name.replace(/[\[]/, "\\[").replace(/[\]]/, "\\]");
  var regex = new RegExp("[\\?&]" + name + "=([^&#]*)"),
    results = regex.exec(location.search);
  return results === null ? "" : decodeURIComponent(results[1].replace(/\+/g, " "));
}
