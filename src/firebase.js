// src/firebase.js
// ---------------------------------------------------------------------------
// SETUP INSTRUCTIONS:
// 1. Go to https://console.firebase.google.com
// 2. Create a new project (e.g. "crashguard-ai")
// 3. Click "Web" icon → Register app → copy the firebaseConfig object below
// 4. In Firebase console:
//    - Authentication → Sign-in method → Enable "Email/Password"
//    - Firestore Database → Create database → Start in test mode
// 5. Replace the values below with your real config
// ---------------------------------------------------------------------------

import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey:            process.env.REACT_APP_FIREBASE_API_KEY            || "PASTE_YOUR_API_KEY",
  authDomain:        process.env.REACT_APP_FIREBASE_AUTH_DOMAIN        || "your-project.firebaseapp.com",
  projectId:         process.env.REACT_APP_FIREBASE_PROJECT_ID         || "your-project-id",
  storageBucket:     process.env.REACT_APP_FIREBASE_STORAGE_BUCKET     || "your-project.appspot.com",
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID|| "000000000000",
  appId:             process.env.REACT_APP_FIREBASE_APP_ID             || "1:000000000000:web:abc123",
};

// Detect if real Firebase config is provided
export const FIREBASE_CONFIGURED =
  firebaseConfig.apiKey !== "PASTE_YOUR_API_KEY" &&
  !firebaseConfig.apiKey.startsWith("PASTE");

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db   = getFirestore(app);
export default app;
