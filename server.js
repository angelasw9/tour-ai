 (cd "$(git rev-parse --show-toplevel)" && git apply --3way <<'EOF' 
diff --git a/server.js b/server.js
index 401daa02d82ebf3b0fb58090e322b2f3c5deb512..583fb08520c214c08d5e3d576f9c11fe3cd9ecaa 100644
--- a/server.js
+++ b/server.js
@@ -1,105 +1,124 @@
- (cd "$(git rev-parse --show-toplevel)" && git apply --3way <<'EOF' 
-diff --git a/server.js b/server.js
-index 49dbc9d8a41cbbb002251260b0604c8e6f1e9c8a..ed0ab90dd757442263942c80dbe561a88fdc5866 100644
---- a/server.js
-+++ b/server.js
-@@ -26,76 +26,83 @@ io.on("connection", (socket) => {
- 
-   socket.on("language", (lang) => {
-     inputLang = lang;
-   });
- 
-   socket.on("audio", (data) => {
-     pushStream.write(data);
-   });
- 
-   const speechConfig = sdk.SpeechConfig.fromSubscription(process.env.AZURE_KEY, process.env.AZURE_REGION);
-   const audioConfig = sdk.AudioConfig.fromStreamInput(pushStream);
-   const recognizer = new sdk.SpeechRecognizer(speechConfig, audioConfig);
- 
-   recognizer.recognizing = (s, e) => {
-     console.log(`Recognizing: ${e.result.text}`);
-   };
- 
-   recognizer.recognized = async (s, e) => {
-     if (e.result.reason === sdk.ResultReason.RecognizedSpeech) {
-       const text = e.result.text;
-       console.log(`Final Result: ${text}`);
- 
-       const targetLangs = ["en", "ja", "ko", "zh-Hant", "fr"];
-       for (const lang of targetLangs) {
-         const translated = await translateText(text, lang);
--        const audioUrl = await synthesizeSpeech(translated, lang);
--        socket.emit("translation", { lang, audioUrl });
-+        if (translated) {
-+          const audioUrl = await synthesizeSpeech(translated, lang);
-+          socket.emit("translation", { lang, audioUrl });
-+        }
-       }
-     }
-   };
- 
-   recognizer.startContinuousRecognitionAsync();
- 
-   socket.on("disconnect", () => {
-     console.log("Client disconnected");
-     recognizer.stopContinuousRecognitionAsync();
-   });
- });
- 
- async function translateText(text, toLang) {
--  const res = await axios({
--    method: "post",
--    url: "https://api.cognitive.microsofttranslator.com/translate?api-version=3.0&to=" + toLang,
--    headers: {
--      "Ocp-Apim-Subscription-Key": process.env.AZURE_KEY,
--      "Ocp-Apim-Subscription-Region": process.env.AZURE_REGION,
--      "Content-Type": "application/json"
--    },
--    data: [{ Text: text }]
--  });
--  return res.data[0].translations[0].text;
-+  try {
-+    const res = await axios({
-+      method: "post",
-+      url: "https://api.cognitive.microsofttranslator.com/translate?api-version=3.0&to=" + toLang,
-+      headers: {
-+        "Ocp-Apim-Subscription-Key": process.env.AZURE_KEY,
-+        "Ocp-Apim-Subscription-Region": process.env.AZURE_REGION,
-+        "Content-Type": "application/json"
-+      },
-+      data: [{ Text: text }]
-+    });
-+    return res.data[0].translations[0].text;
-+  } catch (err) {
-+    console.error("Translation error:", err);
-+    return null;
-+  }
- }
- 
- async function synthesizeSpeech(text, langCode) {
-   const outputFile = `tts-${langCode}-${Date.now()}.mp3`;
-   const voiceMap = {
-     "en": "en-US-JennyNeural",
-     "ja": "ja-JP-NanamiNeural",
-     "ko": "ko-KR-SoonBokNeural",
-     "zh-Hant": "zh-TW-HsiaoChenNeural",
-     "fr": "fr-FR-DeniseNeural"
-   };
- 
-   const speechConfig = sdk.SpeechConfig.fromSubscription(process.env.AZURE_KEY, process.env.AZURE_REGION);
-   speechConfig.speechSynthesisVoiceName = voiceMap[langCode] || "en-US-JennyNeural";
-   const audioConfig = sdk.AudioConfig.fromAudioFileOutput(`public/tts/${outputFile}`);
-   const synthesizer = new sdk.SpeechSynthesizer(speechConfig, audioConfig);
- 
-   return new Promise((resolve) => {
-     synthesizer.speakTextAsync(text, () => {
-       resolve(`/tts/${outputFile}`);
-     });
-   });
- }
- 
- server.listen(3000, () => {
- 
-EOF
-)
+require('dotenv').config();
+const fs = require('fs');
+const path = require('path');
+const express = require('express');
+const http = require('http');
+const { Server } = require('socket.io');
+const sdk = require('microsoft-cognitiveservices-speech-sdk');
+const axios = require('axios');
+
+const app = express();
+app.use(express.static(path.join(__dirname, 'public')));
+
+const server = http.createServer(app);
+const io = new Server(server);
+
+const ttsDir = path.join(__dirname, 'public', 'tts');
+if (!fs.existsSync(ttsDir)) {
+  fs.mkdirSync(ttsDir, { recursive: true });
+}
+
+io.on('connection', (socket) => {
+  console.log('Client connected');
+  const pushStream = sdk.AudioInputStream.createPushStream();
+  let inputLang = 'en-US';
+
+  socket.on('language', (lang) => {
+    inputLang = lang;
+  });
+
+  socket.on('audio', (data) => {
+    if (data instanceof ArrayBuffer) {
+      pushStream.write(Buffer.from(data));
+    } else {
+      pushStream.write(data);
+    }
+  });
+
+  const speechConfig = sdk.SpeechConfig.fromSubscription(
+    process.env.AZURE_KEY,
+    process.env.AZURE_REGION
+  );
+  speechConfig.speechRecognitionLanguage = inputLang;
+  const audioConfig = sdk.AudioConfig.fromStreamInput(pushStream);
+  const recognizer = new sdk.SpeechRecognizer(speechConfig, audioConfig);
+
+  recognizer.recognizing = (s, e) => {
+    console.log(`Recognizing: ${e.result.text}`);
+  };
+
+  recognizer.recognized = async (s, e) => {
+    if (e.result.reason === sdk.ResultReason.RecognizedSpeech) {
+      const text = e.result.text;
+      console.log(`Final Result: ${text}`);
+
+      const targetLangs = ['en', 'ja', 'ko', 'zh-Hant', 'fr'];
+      for (const lang of targetLangs) {
+        const translated = await translateText(text, lang);
+        if (translated) {
+          const audioUrl = await synthesizeSpeech(translated, lang);
+          socket.emit('translation', { lang, audioUrl });
+        }
+      }
+    }
+  };
+
+  recognizer.startContinuousRecognitionAsync();
+
+  socket.on('disconnect', () => {
+    console.log('Client disconnected');
+    recognizer.stopContinuousRecognitionAsync();
+  });
+});
+
+async function translateText(text, toLang) {
+  try {
+    const res = await axios({
+      method: 'post',
+      url:
+        'https://api.cognitive.microsofttranslator.com/translate?api-version=3.0&to=' +
+        toLang,
+      headers: {
+        'Ocp-Apim-Subscription-Key': process.env.AZURE_KEY,
+        'Ocp-Apim-Subscription-Region': process.env.AZURE_REGION,
+        'Content-Type': 'application/json',
+      },
+      data: [{ Text: text }],
+    });
+    return res.data[0].translations[0].text;
+  } catch (err) {
+    console.error('Translation error:', err);
+    return null;
+  }
+}
+
+async function synthesizeSpeech(text, langCode) {
+  const outputFile = `tts-${langCode}-${Date.now()}.mp3`;
+  const voiceMap = {
+    en: 'en-US-JennyNeural',
+    ja: 'ja-JP-NanamiNeural',
+    ko: 'ko-KR-SoonBokNeural',
+    'zh-Hant': 'zh-TW-HsiaoChenNeural',
+    fr: 'fr-FR-DeniseNeural',
+  };
+
+  const speechConfig = sdk.SpeechConfig.fromSubscription(
+    process.env.AZURE_KEY,
+    process.env.AZURE_REGION
+  );
+  speechConfig.speechSynthesisVoiceName = voiceMap[langCode] || 'en-US-JennyNeural';
+  const audioConfig = sdk.AudioConfig.fromAudioFileOutput(
+    path.join('public', 'tts', outputFile)
+  );
+  const synthesizer = new sdk.SpeechSynthesizer(speechConfig, audioConfig);
+
+  return new Promise((resolve) => {
+    synthesizer.speakTextAsync(text, () => {
+      resolve(`/tts/${outputFile}`);
+    });
+  });
+}
+
+server.listen(3000, () => {
+  console.log('Server listening on port 3000');
+});
 
EOF
)
