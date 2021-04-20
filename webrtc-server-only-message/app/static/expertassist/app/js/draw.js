import {sendMarkers, clearMarkers, sendImage, clearImage} from './websocket.js'
import {status} from './manager.js'
//#region [Grey] Draw on the canvas
function Rect(x, y, w, h, color, lineWidth) {
    this.type = "Rect";
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
    this.color = color;
    this.lineWidth = lineWidth;
    this.isSelected = false;
  }
  
  function Arrow(fromx, fromy, tox, toy, color) {
    this.type = "Arrow";
    this.fromx = fromx;
    this.fromy = fromy;
    this.tox = tox;
    this.toy = toy;
    this.color = color;
    this.isSelected = false;
  }
  
  var objects = [];
  var canvas;
  var contextDraw;
  var previousSelectedobject;
  var mouse_coord_buffer = null;
  var isDragging = false;
  
  //=====================page_init===========================
  
  export function init() {
    // console.log('initialzing Draw')

    objects = [];
    mouse_coord_buffer = null;
    isDragging = false;
  
    canvas = document.getElementById("draw_canvas");
    // 直接設定大小
    canvas.height = 720;
    canvas.width = 1280;
    // TODO: 調箭頭大小
    contextDraw = canvas.getContext("2d");
  
    canvas.onmousedown = canvasClick;
    canvas.onmouseup = stopDragging;
    canvas.onmouseout = stopDragging;
    canvas.onmousemove = dragRect;

    // Button initial
    document.getElementById("new_arrow_red_img").onclick = function(){
      console.log('new arrow red')
      new_arrow_red();
    }
    document.getElementById("new_arrow_white_img").onclick = function(){
      new_arrow_white();
    }
    document.getElementById("new_arrow_bluegreen_img").onclick = function(){
      new_arrow_bluegreen();
    }
    document.getElementById("mark_plus_img").onclick = function(){
      btn_Plus();
    }
    document.getElementById("new_square_red_img").onclick = function(){
      new_square_red();
    }
    document.getElementById("new_square_white_img").onclick = function(){
      new_square_white();
    }
    document.getElementById("new_square_bluegreen_img").onclick = function(){
      new_square_bluegreen();
    }
    document.getElementById("mark_minus_img").onclick = function(){
      btn_Minus();
    }
    document.getElementById("send_mark_btn").onclick = function(){
      let data = get_all_marks()
      console.log(data)
      sendMarkers(status.currentHmd, data);
    }
    document.getElementById("clear_mark_btn").onclick = function(){
      clearMarkers(status.currentHmd);
      clearCanvas();
    }
    document.getElementById("file_input").oninput = function(){
       loadFile(this, event)
    }
    document.getElementById("clear_image_btn").onclick = function(){
      clearImage(status.currentHmd)
    }
  }
  
  //============Canvas_Function=================================
  function draw_square(object) {
    contextDraw.lineWidth = object.lineWidth;
    contextDraw.strokeStyle = object.color;
    contextDraw.rect(object.x, object.y, object.w, object.h);
    contextDraw.stroke();
  }
  
  
  function draw_arrow(object, arrowStart = false, arrowEnd = true) {
    var x0 = object.fromx;
    var x1 = object.tox;
    var y0 = object.fromy;
    var y1 = object.toy;
  
    var dx = x1 - x0;
    var dy = y1 - y0;
    var aWidth = 5;
    var aLength = 10;
  
    var angle = Math.atan2(dy, dx);
    var length = Math.sqrt(dx * dx + dy * dy);
  
    contextDraw.lineWidth = 5;
    contextDraw.translate(x0, y0);
    contextDraw.rotate(angle);
    contextDraw.beginPath();
    contextDraw.moveTo(0, 0);
    contextDraw.lineTo(length, 0);
    if (arrowStart) {
      contextDraw.moveTo(aLength, -aWidth);
      contextDraw.lineTo(0, 0);
      contextDraw.lineTo(aLength, aWidth);
    }
    if (arrowEnd) {
      contextDraw.moveTo(length - aLength - 4, -aWidth - 2);
      contextDraw.lineTo(length, 0);
      contextDraw.lineTo(length - aLength, aWidth);
      contextDraw.lineTo(length - aLength, -aWidth);
    }
    //
    // contextDraw.fill();
    // contextDraw.stroke();
    contextDraw.setTransform(1, 0, 0, 1, 0, 0);
  }
  
  function new_square_red() {
    var x = canvas.width / 2;
    var y = canvas.height / 2;
    var w = 80;
    var h = 80;
    var lineWidth = "6";
    var object = new Rect(x, y, w, h, "red", lineWidth);
    objects.push(object);
    drawRect();
  }
  
  function new_square_white() {
    var x = canvas.width / 2;
    var y = canvas.height / 2;
    var w = 80;
    var h = 80;
    var lineWidth = "6";
    var object = new Rect(x, y, w, h, "white", lineWidth);
    objects.push(object);
    drawRect();
  }
  
  function new_square_bluegreen() {
    var x = canvas.width / 2;
    var y = canvas.height / 2;
    var w = 80;
    var h = 80;
    var lineWidth = "6";
    var object = new Rect(x, y, w, h, "#00fbff", lineWidth);
    objects.push(object);
    drawRect();
  }
  
  function new_arrow_red() {
    var fromx = canvas.width / 2;
    var fromy = canvas.height / 2;
    var tox = canvas.width / 2 - 25;
    var toy = canvas.height / 2 - 25;
  var object = new Arrow(fromx, fromy, tox, toy, "red");
    objects.push(object);
    drawRect();
  }
  
  function new_arrow_white() {
    var fromx = canvas.width / 2;
    var fromy = canvas.height / 2;
    var tox = canvas.width / 2 - 25;
    var toy = canvas.height / 2 - 25;
    var object = new Arrow(fromx, fromy, tox, toy, "white");
    objects.push(object);
    drawRect();
  }
  
  function new_arrow_bluegreen() {
    var fromx = canvas.width / 2;
    var fromy = canvas.height / 2;
    var tox = canvas.width / 2 - 25;
    var toy = canvas.height / 2 - 25;
    var object = new Arrow(fromx, fromy, tox, toy, "#00fbff");
    objects.push(object);
    drawRect();
  }
  
  function btn_Plus() {
    if (previousSelectedobject != null) {
      if (previousSelectedobject.type == "Rect") {
        previousSelectedobject.x = previousSelectedobject.x - 5;
        previousSelectedobject.y = previousSelectedobject.y - 5;
        previousSelectedobject.w = previousSelectedobject.w + 10;
        previousSelectedobject.h = previousSelectedobject.h + 10;
      } else {
        previousSelectedobject.fromx = previousSelectedobject.fromx + 10;
        previousSelectedobject.fromy = previousSelectedobject.fromy + 10;
        previousSelectedobject.tox = previousSelectedobject.tox - 10;
        previousSelectedobject.toy = previousSelectedobject.toy - 10;
      }
      drawRect();
    }
  }
  
  function btn_Minus() {
    if (previousSelectedobject != null) {
      if (previousSelectedobject.type == "Rect") {
        previousSelectedobject.x = previousSelectedobject.x + 5;
        previousSelectedobject.y = previousSelectedobject.y + 5;
        previousSelectedobject.w = previousSelectedobject.w - 10;
        previousSelectedobject.h = previousSelectedobject.h - 10;
      } else {
        previousSelectedobject.fromx = previousSelectedobject.fromx - 10;
        previousSelectedobject.fromy = previousSelectedobject.fromy - 10;
        previousSelectedobject.tox = previousSelectedobject.tox + 10;
        previousSelectedobject.toy = previousSelectedobject.toy + 10;
      }
      drawRect();
    }
  }
  
  function clearCanvas() {
    objects = [];
    drawRect();
  }

  function disableScaling(){
    document.getElementById("mark_plus_img").classList.add("grayscale")
    document.getElementById("mark_minus_img").classList.add("grayscale")
    document.getElementById("mark_plus_btn").style = `pointer-events:none`
    document.getElementById("mark_minus_btn").style = `pointer-events:none`
  }
  function enableScaling(){
    document.getElementById("mark_plus_img").classList.remove("grayscale")
    document.getElementById("mark_minus_img").classList.remove("grayscale")
    document.getElementById("mark_plus_btn").style = ``
    document.getElementById("mark_minus_btn").style = ``
  }
  
  function drawRect() {
    contextDraw.clearRect(0, 0, canvas.width, canvas.height);
  
    for (var i = 0; i < objects.length; i++) {
      var object = objects[i];
      contextDraw.beginPath();
  
      if (object.type == "Rect") {
        draw_square(object);
      } else if (object.type == "Arrow") {
        draw_arrow(object);
      }
  
      if (object.isSelected) {
        contextDraw.strokeStyle = "yellow";
        contextDraw.stroke();
      } else {
        contextDraw.strokeStyle = object.color;
        contextDraw.stroke();
      }
    }
  }
  
  function find_area(object, clickX, clickY) {
    if (object.type == "Rect") {
      if (
        clickX >= object.x &&
        clickY >= object.y &&
        clickX <= object.x + object.w &&
        clickY <= object.y + object.h
      ) {
        return true;
      }
    } else {
      // console.log(`from : ${object.fromx}, ${object.fromy}`);
      // console.log(`to : ${object.tox}, ${object.toy}`);
      // console.log("clickX: " + clickX);
      // console.log("clickY: " + clickY);
      if (
        clickX <= object.fromx &&
        clickY <= object.fromy &&
        clickX >= object.tox &&
        clickY >= object.toy
      ) {
        return true;
      }
    }
  
    return false;
  }
  
  function canvasClick(e) {
    // var clickX = e.pageX - canvas.offsetLeft;
    // var clickY = e.pageY - canvas.offsetTop;
    var offset = $(e.currentTarget).offset();
    var clickX = e.pageX - offset.left;
    var clickY = e.pageY - offset.top;
    
    // 校正RWD
    clickX = clickX/canvas.clientWidth * canvas.width;
    clickY = clickY/canvas.clientHeight * canvas.height;
    
    // console.log(`click x: ${clickX}`);
    // console.log(`click y: ${clickY}`);
    for (var i = objects.length - 1; i >= 0; i--) {
      var object = objects[i];
      contextDraw.fillStyle = object.color;
      // contextDraw.fill();
      // contextDraw.stroke();
      if (find_area(object, clickX, clickY)) {
        //console.log(object.type);
        if (previousSelectedobject != null) previousSelectedobject.isSelected = false;
        previousSelectedobject = object;
        object.isSelected = true;
        isDragging = true;
        mouse_coord_buffer = [clickX, clickY];
        if (object.type == "Arrow") disableScaling();
        else enableScaling();
        drawRect();
        return;
      } else {
        enableScaling();
        object.isSelected = false;
      }
    }
    previousSelectedobject = null;
    drawRect();
  }
  
  function stopDragging() {
    isDragging = false;
    mouse_coord_buffer = null;
  }
  
  function dragRect(e) {
    //console.log(e);
    // 圖上座標轉換成canvas座標
    var ratio = canvas.clientWidth / canvas.width;
    if (isDragging == true) {
      if (previousSelectedobject != null) {
        if (previousSelectedobject.type == "Rect") {
          // var x = e.pageX - canvas.offsetLeft;
          // var y = e.pageY - canvas.offsetTop;
          var offset = $(e.currentTarget).offset();
          var x = e.pageX - offset.left;
          var y = e.pageY - offset.top;
          x = x / ratio
          y = y / ratio
        
          previousSelectedobject.x = previousSelectedobject.x + (x - mouse_coord_buffer[0]);
          previousSelectedobject.y = previousSelectedobject.y + (y - mouse_coord_buffer[1]);
          mouse_coord_buffer = [x, y];
        } else {
          // var shift_x = e.pageX - canvas.offsetLeft;
          // var shift_y = e.pageY - canvas.offsetTop;
          var offset = $(e.currentTarget).offset();
  
          var shift_x = e.pageX - offset.left;
          var shift_y = e.pageY - offset.top;
          // 校正
          shift_x = shift_x / ratio
          shift_y = shift_y / ratio
  
          previousSelectedobject.fromx =
            previousSelectedobject.fromx + (shift_x - mouse_coord_buffer[0]);
          previousSelectedobject.fromy =
            previousSelectedobject.fromy + (shift_y - mouse_coord_buffer[1]);
          previousSelectedobject.tox = previousSelectedobject.tox + (shift_x - mouse_coord_buffer[0]);
          previousSelectedobject.toy = previousSelectedobject.toy + (shift_y - mouse_coord_buffer[1]);
          mouse_coord_buffer = [shift_x, shift_y];
        }
        drawRect();
      }
    }
  }
  
  //===================upload_file_event=========================
  var loadFile = async function (sender, event) {
    // var validExt = new Array(".jpg");
    var validExt = [".jpg", ".jpeg", ".JPG", ".JPEG", ".png", ".PNG"];
    var fileExt = sender.value;
  
    fileExt = fileExt.substring(fileExt.lastIndexOf("."));
  
    if (validExt.indexOf(fileExt) < 0) {
      sender.value = "";
      return false;
    } else {
      var reader = new FileReader();
      // Convert img to base64
      // reader.readAsDataURL(sender.files[0]);
  
      var config = {
        file: sender.files[0],
        maxSize: 500,
      };
      var resizedImage = await resizeImage(config);
      reader.readAsDataURL(resizedImage);
  
      // var fileByteArray = [];
      //reader.readAsArrayBuffer(new Blob([sender.files[0]]));
      reader.onloadend = async function (evt) {
        if (evt.target.readyState == FileReader.DONE) {
          var bytes = String(reader.result);
          // console.log(bytes);
          bytes = bytes.replace("data:image/jpeg;base64,", "");
          bytes = bytes.replace("data:image/png;base64,", "");
          // console.log(bytes)
          sendImage(status.currentHmd, bytes);
          sender.value = "";
          return true;
        } else {
          sender.value = "";
          return false;
        }
      };
    }
  };
  
  var resizeImage = function (settings) {
    var file = settings.file;
    var maxSize = settings.maxSize;
    var reader = new FileReader();
    var image = new Image();
    var canvasResize = document.createElement("canvas");
    var dataURItoBlob = function (dataURI) {
      var bytes =
        dataURI.split(",")[0].indexOf("base64") >= 0
          ? atob(dataURI.split(",")[1])
          : unescape(dataURI.split(",")[1]);
      var mime = dataURI.split(",")[0].split(":")[1].split(";")[0];
      var max = bytes.length;
      var ia = new Uint8Array(max);
      for (var i = 0; i < max; i++) ia[i] = bytes.charCodeAt(i);
      return new Blob([ia], { type: mime });
    };
    var resize = function () {
      var width = image.width;
      var height = image.height;
      if (width > height) {
        if (width > maxSize) {
          height *= maxSize / width;
          width = maxSize;
        }
      } else {
        if (height > maxSize) {
          width *= maxSize / height;
          height = maxSize;
        }
      }
      canvasResize.width = width;
      canvasResize.height = height;
      canvasResize.getContext("2d").drawImage(image, 0, 0, width, height);
      var dataUrl = canvasResize.toDataURL("image/jpeg");
      return dataURItoBlob(dataUrl);
    };
    return new Promise(function (ok, no) {
      if (!file.type.match(/image.*/)) {
        no(new Error("Not an image"));
        return;
      }
      reader.onload = function (readerEvent) {
        image.onload = function () {
          return ok(resize());
        };
        image.src = readerEvent.target.result;
      };
      reader.readAsDataURL(file);
    });
  };
  
  //===================Hidden_tag================================
  var hidden_status = false;
  export function showToolbox() {
    document.getElementById("MARK").style.visibility = "visible";
    document.getElementById("PICTURE").style.visibility = "visible";
    hidden_status = true;
  }
  export function hideToolbox() {
    document.getElementById("MARK").style.visibility = "hidden";
    document.getElementById("PICTURE").style.visibility = "hidden";
    hidden_status = false;
  }
  
  //===================For_HMD_data===============================
  export function collect_marks(object) {
    let type = "";
    let color = "";
    // var object_id = "0";
    var mark_Lpos = { x: 0, y: 0 };
    var mark_Rpos = { x: 0, y: 0 };
  
    if (object.type == "Rect") {
      type = "square"
      if (object.color == "red") {
        color = "red";
      } else if (object.color == "white") {
        color = "white";
      } else if (object.color == "#00fbff") {
        color = "blue";
      }
  
      mark_Lpos = { x: object.x, y: object.y };
      mark_Rpos = { x: object.x + object.w, y: object.y + object.h };
    } else {
      type = "arrow"
      if (object.color == "red") {
        color = "red";
      } else if (object.color == "white") {
        color = "white";
      } else if (object.color == "#00fbff") {
        color = "blue";
      }
  
      mark_Lpos = { x: object.tox, y: object.toy };
      mark_Rpos = { x: object.fromx, y: object.fromy };
    }
    // console.log(`send back : ${mark_Lpos.x}, ${mark_Lpos.y} and ${mark_Rpos.x}, ${mark_Rpos.y}`);
  
    return {
      type: type,
      color: color,
      Lpos: mark_Lpos,
      Rpos: mark_Rpos,
    };
  }
  
  export function get_all_marks() {
    var marks = [];
    for (var i = 0; i < objects.length; i++) {
      var object = objects[i];
      marks.push(collect_marks(object));
    }
    clearCanvas();
    return marks;
  }
  //#endregion
  