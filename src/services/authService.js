// src/services/authService.js
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth';
import { auth, FIREBASE_CONFIGURED } from '../firebase';

const DEMO_USER_KEY = 'crashguard_demo_user';

export async function register(email, password) {
  if (FIREBASE_CONFIGURED) {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    return { uid: cred.user.uid, email: cred.user.email };
  } else {
    const uid = 'demo_' + email.replace(/[^a-z0-9]/gi, '_');
    const user = { uid, email };
    localStorage.setItem(DEMO_USER_KEY, JSON.stringify(user));
    return user;
  }
}

export async function login(email, password) {
  if (FIREBASE_CONFIGURED) {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    return { uid: cred.user.uid, email: cred.user.email };
  } else {
    // Demo mode: accept any credentials
    const uid = 'demo_' + email.replace(/[^a-z0-9]/gi, '_');
    const user = { uid, email };
    localStorage.setItem(DEMO_USER_KEY, JSON.stringify(user));
    return user;
  }
}

export async function logout() {
  if (FIREBASE_CONFIGURED) {
    await signOut(auth);
  }
  localStorage.removeItem(DEMO_USER_KEY);
}

export function getCurrentUser() {
  if (FIREBASE_CONFIGURED) {
    return auth.currentUser;
  }
  try {
    return JSON.parse(localStorage.getItem(DEMO_USER_KEY) || 'null');
  } catch {
    return null;
  }
}

export function onAuthChange(callback) {
  if (FIREBASE_CONFIGURED) {
    return onAuthStateChanged(auth, callback);
  } else {
    // Check localStorage immediately
    const user = getCurrentUser();
    callback(user);
    return () => {}; // unsubscribe noop
  }
}
