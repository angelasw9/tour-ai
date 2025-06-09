// server.js - 使用 WebRTC 實現語音即時串流 + 翻譯 + 播放

require("dotenv").config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const sdk = require("microsoft-cognitiveservices-speech-sdk");
const fs = require("fs");
const path = require("path");
const axios = require("axios");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));
app.use("/tts", express.static("public/tts"));

io.on("connection", (socket) => {
  console.log("Client connected");

  const speechConfig = sdk.SpeechConfig.fromSubscription(process.env.AZURE_KEY, process.env.AZURE_REGION);
  speechConfig.speechRecognitionLanguage = "en-US";
  const pushStream = sdk.AudioInputStream.createPushStream();
  const audioConfig = sdk.AudioConfig.fromStreamInput(pushStream);
  const recognizer = new sdk.SpeechRecognizer(speechConfig, audioConfig);

  recognizer.recognizing = (s, e) => {
    console.log(`Recognizing: ${e.result.text}`);
  };

  recognizer.recognized = async (s, e) => {
    if (e.result.reason === sdk.ResultReason.RecognizedSpeech) {
      const text = e.result.text;
      console.log(`Final Result: ${text}`);

      const translated = await translateText(text);
      const url = await synthesizeSpeech(translated);
      socket.emit("translation", { audioUrl: url });
    }
  };

  recognizer.startContinuousRecognitionAsync();

  socket.on("audio", (data) => {
    pushStream.write(data);
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected");
    recognizer.stopContinuousRecognitionAsync();
  });
});

async function translateText(text) {
  const res = await axios({
    method: "post",
    url: "https://api.cognitive.microsofttranslator.com/translate?api-version=3.0&to=ja",
    headers: {
      "Ocp-Apim-Subscription-Key": process.env.AZURE_KEY,
      "Ocp-Apim-Subscription-Region": process.env.AZURE_REGION,
      "Content-Type": "application/json",
    },
    data: [{ Text: text }],
  });
  return res.data[0].translations[0].text;
}

async function synthesizeSpeech(text) {
  const outputFile = `tts-${Date.now()}.mp3`;
  const speechConfig = sdk.SpeechConfig.fromSubscription(process.env.AZURE_KEY, process.env.AZURE_REGION);
  speechConfig.speechSynthesisVoiceName = "ja-JP-NanamiNeural";
  const audioConfig = sdk.AudioConfig.fromAudioFileOutput(`public/tts/${outputFile}`);
  const synthesizer = new sdk.SpeechSynthesizer(speechConfig, audioConfig);
  return new Promise((resolve) => {
    synthesizer.speakTextAsync(text, () => {
      resolve(`/tts/${outputFile}`);
    });
  });
}

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

server.listen(3000, () => {
  console.log("Server started on http://localhost:3000");
});

// public/guide.html - 導遊端
/*
<!DOCTYPE html>
<html>
<head><title>導遊端</title></head>
<body>
  <h2>導遊語音上傳</h2>
  <button id="start">開始講話</button>
  <script>
    const socket = io();
    let mediaRecorder;

    document.getElementById("start").onclick = async () => {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder = new MediaRecorder(stream);
      mediaRecorder.start(250); // 每 250ms 傳送一次片段

      mediaRecorder.ondataavailable = e => {
        socket.emit("audio", e.data);
      };
    };
  </script>
  <script src="/socket.io/socket.io.js"></script>
</body>
</html>
*/

// public/visitor.html - 遊客端
/*
<!DOCTYPE html>
<html>
<head><title>遊客端</title></head>
<body>
  <h2>收聽翻譯語音</h2>
  <audio id="player" controls autoplay></audio>
  <script>
    const socket = io();
    const audio = document.getElementById("player");

    socket.on("translation", (data) => {
      audio.src = data.audioUrl;
    });
  </script>
  <script src="/socket.io/socket.io.js"></script>
</body>
</html>
*/
