# 🚨 CrashGuard AI — Emergency Intelligence System

A privacy-preserving, AI-powered crash assessment web app.

## ⚡ Quick Start

```bash
# 1. Open terminal in the crashguard folder
npm install
npm start
# Opens at http://localhost:3000
# Login with ANY email + password
```

## Demo Steps
1. Sign in with any email/password
2. Click **⊕ Enable Camera** (allow browser permission)
3. Click **⚠ Simulate Crash** → AI pipeline animates
4. Review report → Click **📡 Send Emergency Report**
5. Check **History** tab for logged incidents
6. Update **Profile** to see live email preview

## Enable Real Emails (Optional)
1. Sign up at emailjs.com
2. Copy `.env.example` → `.env`
3. Fill in your EmailJS keys
4. Restart: `npm start`

## Project Structure
```
src/
├── context/AppContext.js      ← Global state
├── components/
│   ├── UI.js                  ← Buttons, inputs, cards
│   ├── Sidebar.js             ← Navigation
│   ├── Toast.js               ← Notifications
│   └── CrashModal.js          ← AI processing modal
├── pages/
│   ├── Login.js               ← Auth
│   ├── Dashboard.js           ← Camera + crash trigger
│   ├── Dashcam.js             ← Device settings
│   ├── History.js             ← Incident log
│   └── Profile.js             ← Driver profile
└── App.js                     ← Router
```

## Email Recipients
- Configure EmailJS keys in .env from .env.example to enable real sending.
- Emergency reports can now send to both family and dispatcher emails.
- Add recipient addresses in Profile: Emergency Contact Email and Dispatcher Email.

## Ollama Crash Analysis
- Local Ollama endpoint is expected at `http://localhost:11434/api/generate`.
- Configure templates in `.env` with:
  - `REACT_APP_EMAILJS_TEMPLATE_DISPATCHER_ID`
  - `REACT_APP_EMAILJS_TEMPLATE_LOVED_ONES_ID`

## TFLite Crash Model Integration (Local)
- The app now supports a local vision model endpoint for crash analysis.
- Set `.env`:
  - `REACT_APP_ANALYSIS_PROVIDER=local_model` (or `auto` for local model then Ollama fallback)
  - `REACT_APP_CRASH_MODEL_URL=http://127.0.0.1:5000/analyze`

Run local model server:
```bash
cd ml
python -m venv .venv
# Windows
.venv\Scripts\activate
pip install -r requirements.txt
# Option A: place best_float32.tflite in this ml/ folder
# Option B: point to existing model file
# set CRASH_MODEL_PATH=C:\Users\Santhosh\OneDrive\Desktop\Crash test\best_float32.tflite
python local_server.py
```

Quick checks:
- `http://127.0.0.1:5000/health`
- `POST http://127.0.0.1:5000/analyze`
