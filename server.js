const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const sdk = require("microsoft-cognitiveservices-speech-sdk");
const fs = require("fs");
const path = require("path");
const axios = require("axios");
require("dotenv").config();

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));
app.use("/tts", express.static("public/tts"));

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

io.on("connection", (socket) => {
  console.log("Client connected");

  let inputLang = "en-US"; // 預設輸入語言
  const pushStream = sdk.AudioInputStream.createPushStream();

  socket.on("language", (lang) => {
    inputLang = lang;
  });

  socket.on("audio", (data) => {
    pushStream.write(data);
  });

  const speechConfig = sdk.SpeechConfig.fromSubscription(process.env.AZURE_KEY, process.env.AZURE_REGION);
  const audioConfig = sdk.AudioConfig.fromStreamInput(pushStream);
  const recognizer = new sdk.SpeechRecognizer(speechConfig, audioConfig);

  recognizer.recognizing = (s, e) => {
    console.log(`Recognizing: ${e.result.text}`);
  };

  recognizer.recognized = async (s, e) => {
    if (e.result.reason === sdk.ResultReason.RecognizedSpeech) {
      const text = e.result.text;
      console.log(`Final Result: ${text}`);

      const targetLangs = ["en", "ja", "ko", "zh-Hant", "fr"];
      for (const lang of targetLangs) {
        const translated = await translateText(text, lang);
        const audioUrl = await synthesizeSpeech(translated, lang);
        socket.emit("translation", { lang, audioUrl });
      }
    }
  };

  recognizer.startContinuousRecognitionAsync();

  socket.on("disconnect", () => {
    console.log("Client disconnected");
    recognizer.stopContinuousRecognitionAsync();
  });
});

async function translateText(text, toLang) {
  const res = await axios({
    method: "post",
    url: "https://api.cognitive.microsofttranslator.com/translate?api-version=3.0&to=" + toLang,
    headers: {
      "Ocp-Apim-Subscription-Key": process.env.AZURE_KEY,
      "Ocp-Apim-Subscription-Region": process.env.AZURE_REGION,
      "Content-Type": "application/json"
    },
    data: [{ Text: text }]
  });
  return res.data[0].translations[0].text;
}

async function synthesizeSpeech(text, langCode) {
  const outputFile = `tts-${langCode}-${Date.now()}.mp3`;
  const voiceMap = {
    "en": "en-US-JennyNeural",
    "ja": "ja-JP-NanamiNeural",
    "ko": "ko-KR-SoonBokNeural",
    "zh-Hant": "zh-TW-HsiaoChenNeural",
    "fr": "fr-FR-DeniseNeural"
  };

  const speechConfig = sdk.SpeechConfig.fromSubscription(process.env.AZURE_KEY, process.env.AZURE_REGION);
  speechConfig.speechSynthesisVoiceName = voiceMap[langCode] || "en-US-JennyNeural";
  const audioConfig = sdk.AudioConfig.fromAudioFileOutput(`public/tts/${outputFile}`);
  const synthesizer = new sdk.SpeechSynthesizer(speechConfig, audioConfig);

  return new Promise((resolve) => {
    synthesizer.speakTextAsync(text, () => {
      resolve(`/tts/${outputFile}`);
    });
  });
}

server.listen(3000, () => {
  console.log("Server started on http://localhost:3000");
});
