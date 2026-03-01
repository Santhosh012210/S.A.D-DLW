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
