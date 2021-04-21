let canvas = document.getElementById("canvas");
let test = document.getElementById("test");

canvas.width = 0.98 * window.innerWidth;
canvas.height = window.innerHeight;

var io = io.connect("https://dopewhiteboard.herokuapp.com/");

let ctx = canvas.getContext("2d");

let x;
let y;
let mouseDown = false;
let dataChannel;
const servers = {
  iceServers: [
    {
      urls: ["stun:stun1.l.google.com:19302", "stun:stun2.l.google.com:19302"],
    },
  ],
  iceCandidatePoolSize: 10,
};
let pc = new RTCPeerConnection(servers);

console.log("created data channels");
let remoteStream;

function applyEvents() {
  dataChannel.onmessage = (e) => {
    let data = JSON.parse(e.data);

    if (data.draw) {
      ctx.lineTo(data.draw.x, data.draw.y);
      ctx.stroke();
    }
    if (data.down) {
      ctx.moveTo(data.down.x, data.down.y);
    }
  };
}

window.onload = async () => {
  pc.addEventListener("connectionstatechange", (event) => {
    if (pc.connectionState === "connected") {
      //console.log("connected");
    }
  });

  pc.ondatachannel = (e) => {
    console.log("re data channels");
    dataChannel = e.channel;
    applyEvents();
  };

  dataChannel = pc.createDataChannel("test");

  let stream = await navigator.mediaDevices.getUserMedia({ video: true });

  stream.getTracks().forEach((track) => {
    pc.addTrack(track, stream);
  });

  remoteStream = new MediaStream();

  pc.ontrack = (event) => {
    event.streams[0].getTracks().forEach((track) => {
      remoteStream.addTrack(track);
    });
  };

  test.srcObject = remoteStream;

  //sending the ice candidates
  pc.onicecandidate = (event) => {
    if (event.candidate) {
      //console.log("send ice");
      io.emit("propogate", { ice: event.candidate });
    }
  };

  //sending the offer
  let offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  //console.log("send offer");
  io.emit("propogate", {
    offer: { type: offer.type, sdp: offer.sdp },
  });
};

io.on("onpropogate", async (data) => {
  //console.log("happen");
  if (data.offer) {
    //console.log("offer");
    await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
    let answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    io.emit("propogate", { answer });
  }
  if (data.answer) {
    //console.log("answer");
    await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
  }
  if (data.ice) {
    //console.log("ice");
    await pc.addIceCandidate(data.ice);
  }
});

window.onmousedown = (e) => {
  ctx.moveTo(x, y);
  if (dataChannel !== undefined) {
    dataChannel.send(JSON.stringify({ down: { x, y } }));
  } else {
    //console.log("not defined");
  }
  mouseDown = true;
};

window.onmouseup = (e) => {
  mouseDown = false;
};

window.onmousemove = (e) => {
  x = e.clientX;
  y = e.clientY;

  if (mouseDown) {
    dataChannel.send(JSON.stringify({ draw: { x, y } }));
    ctx.lineTo(x, y);
    ctx.stroke();
  }
};
