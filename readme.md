 (cd "$(git rev-parse --show-toplevel)" && git apply --3way <<'EOF' 
diff --git a//dev/null b/README.md
index 0000000000000000000000000000000000000000..a587e045939f6cce836a7d23fe76fadefdfe18f7 100644
--- a//dev/null
+++ b/README.md
@@ -0,0 +1,35 @@
+# Tour AI Realtime Translation
+
+This project is a Node.js application that provides real-time speech translation for tour guides and visitors. It streams audio from a tour guide, converts the speech to text using Azure Cognitive Services, translates the text to multiple languages, synthesizes the translated speech, and serves the resulting audio to visitors via WebSockets.
+
+## Prerequisites
+
+- **Node.js `>=18`** – see the engines field in `package.json`.
+- npm (comes with Node).
+- Azure Cognitive Services credentials for Speech and Translator APIs.
+
+
+## Running Locally
+
+1. Install dependencies:
+
+   ```bash
+   npm install
+   ```
+
+2. Start the server:
+
+   ```bash
+   npm start
+   ```
+
+The application will run on [http://localhost:3000](http://localhost:3000). Open this URL in a browser and choose either the guide or visitor interface.
+
 
EOF
)
