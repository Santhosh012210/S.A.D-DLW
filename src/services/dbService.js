// src/services/dbService.js
// Real Firestore CRUD — falls back to localStorage when Firebase not configured

import {
  collection, addDoc, getDocs, query,
  where, orderBy, serverTimestamp, doc, setDoc,
} from 'firebase/firestore';
import { db, FIREBASE_CONFIGURED } from '../firebase';

const LOCAL_KEY = 'crashguard_incidents';

// ─── Incidents ─────────────────────────────────────────────────────────────

export async function saveIncident(userId, incident) {
  if (FIREBASE_CONFIGURED) {
    const ref = await addDoc(collection(db, 'incidents'), {
      ...incident,
      userId,
      createdAt: serverTimestamp(),
    });
    return { id: ref.id, ...incident };
  } else {
    // localStorage fallback
    const all = getLocalIncidents();
    const saved = { ...incident, id: Date.now().toString(), userId };
    localStorage.setItem(LOCAL_KEY, JSON.stringify([saved, ...all]));
    return saved;
  }
}

export async function fetchIncidents(userId) {
  if (FIREBASE_CONFIGURED) {
    const q = query(
      collection(db, 'incidents'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } else {
    return getLocalIncidents().filter(i => !userId || i.userId === userId);
  }
}

function getLocalIncidents() {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]');
  } catch {
    return [];
  }
}

// ─── User Profile ──────────────────────────────────────────────────────────

const PROFILE_KEY = 'crashguard_profile';

export async function saveProfile(userId, profile) {
  if (FIREBASE_CONFIGURED) {
    await setDoc(doc(db, 'users', userId), profile, { merge: true });
  } else {
    localStorage.setItem(PROFILE_KEY + '_' + userId, JSON.stringify(profile));
  }
}

export async function loadProfile(userId) {
  if (FIREBASE_CONFIGURED) {
    const { getDoc } = await import('firebase/firestore');
    const snap = await getDoc(doc(db, 'users', userId));
    return snap.exists() ? snap.data() : null;
  } else {
    try {
      return JSON.parse(localStorage.getItem(PROFILE_KEY + '_' + userId) || 'null');
    } catch {
      return null;
    }
  }
}
