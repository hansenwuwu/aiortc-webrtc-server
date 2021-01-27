# webrtc-python-javascript

**1.0.0 版 可對接 unity 和 javascript**  
<br/>

##Requirement  
  
* WebRTC sample  (munge-sdp): https://github.com/webrtc/samples 
* Python  (aiortc -> examples/videostream-cli): https://github.com/aiortc/aiortc  
* node dss(暫時的 signaling server): https://github.com/bengreenier/node-dss
<br/> 

# 利用 node dss 傳遞 SDP
## 使用方法
#### node dss 
```
set DEBUG=dss*
npm install
npm start
```

#### Python
注意: 一定要在 linux 上運行，且具備webcam  
注意: 記得到 aiortc reamde 安裝必要套件  
Script: webrtc-python-videostream-cli/cli.py
```
python cli.py answer
```

#### javascript
Script: munge-sdp/index.html
1. 打開 index.html (先用 firefox 開啟，chrome 似乎不穩定)  
2. Get media  
3. Create peer connection  
4. Signaling  
5. Create offer  
6. Set offer  
7. Show modify offer    

  
  
# 利用 web service 傳遞 SDP
## Issue
目前任一 peer 離線是不會偵測到的  
那些已離線的 peer id 還是會在 list 裡面  
所以要重開 server :)

## 使用方法
#### Python
Script: webrtc-python-videostream-cli/server.py  
```
python server.py
```

#### javascript
注意: 記得更改 連接至 server 的 ip 
Script: munge-sdp - for - server/index.html  
<br>
目前還沒測試 hololens，因此先用 js 假扮 hololens, aircc 做測試。
<br>
<br>
**仿 Hololens**
1. 打開 index.html (先用 firefox 開啟，chrome 似乎不穩定)  
2. Get media  
3. Call 
<br>
<br>

**檢查有誰在線上**
```
http://{server ip}:{server port}/getPeerList
```
回傳的結果每一筆都是目前在線的 id  
Hololens 開頭的是 仿 hololens
PeerConnection 開頭的是 peer  
<br>

**將 peer 連上，並且得到 hololens 影像**
1. 打開 index.html (先用 firefox 開啟，chrome 似乎不穩定)  
2. Get media  
3. 用 http://{server ip}:{server port}/getPeerList 取得要的 id
4. 複製 id 貼到瀏覽器上 offer sdp 空格中
5. Call 
<br>
