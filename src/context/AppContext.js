// src/context/AppContext.js
import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { login as authLogin, register as authRegister, logout as authLogout, onAuthChange } from '../services/authService';
import { saveIncident, fetchIncidents, saveProfile, loadProfile } from '../services/dbService';
import { sendEmergencyEmail, EMAIL_CONFIGURED } from '../services/emailService';
import { FIREBASE_CONFIGURED } from '../firebase';

const AppContext = createContext(null);

const EMPTY_PROFILE = {
  name: '', email: '', phone: '',
  emergencyEmail: '', emergencyName: '',
  plate: '', vehicle: '', vehicleColor: '', blood: 'O+',
};

export function AppProvider({ children }) {
  const [authUser,  setAuthUser]  = useState(null);
  const [profile,   setProfile]   = useState(EMPTY_PROFILE);
  const [incidents, setIncidents] = useState([]);
  const [toasts,    setToasts]    = useState([]);
  const [cameraConnected, setCameraConnected] = useState(false);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    const unsub = onAuthChange(async (firebaseUser) => {
      if (firebaseUser) {
        setAuthUser(firebaseUser);
        try {
          const saved = await loadProfile(firebaseUser.uid);
          if (saved) setProfile(p => ({ ...p, ...saved }));
        } catch {}
        try {
          const hist = await fetchIncidents(firebaseUser.uid);
          setIncidents(hist);
        } catch {}
      } else {
        setAuthUser(null);
        setProfile(EMPTY_PROFILE);
        setIncidents([]);
      }
      setAuthReady(true);
    });
    return unsub;
  }, []);

  const showToast = useCallback((message, type = 'success') => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4500);
  }, []);

  const doLogin = useCallback(async (email, password) => {
    const user = await authLogin(email, password);
    setAuthUser(user);
    return user;
  }, []);

  const doRegister = useCallback(async (email, password, profileData) => {
    const user = await authRegister(email, password);
    setAuthUser(user);
    const merged = { ...EMPTY_PROFILE, ...profileData, email };
    setProfile(merged);
    await saveProfile(user.uid, merged).catch(() => {});
    return user;
  }, []);

  const doLogout = useCallback(async () => {
    await authLogout();
    setAuthUser(null);
    setProfile(EMPTY_PROFILE);
    setIncidents([]);
    setCameraConnected(false);
  }, []);

  const updateProfile = useCallback(async (data) => {
    const merged = { ...profile, ...data };
    setProfile(merged);
    if (authUser) await saveProfile(authUser.uid, merged).catch(() => {});
  }, [profile, authUser]);

  const addIncident = useCallback(async (incident) => {
    const saved = authUser
      ? await saveIncident(authUser.uid, incident).catch(() => ({ ...incident, id: Date.now().toString() }))
      : { ...incident, id: Date.now().toString() };
    setIncidents(prev => [saved, ...prev]);
    return saved;
  }, [authUser]);

  const sendReport = useCallback(async (incident) => {
    return await sendEmergencyEmail({ user: profile, incident });
  }, [profile]);

  return (
    <AppContext.Provider value={{
      authUser, authReady, isLoggedIn: !!authUser,
      doLogin, doRegister, doLogout,
      profile, updateProfile,
      incidents, addIncident,
      sendReport, EMAIL_CONFIGURED, FIREBASE_CONFIGURED,
      toasts, showToast,
      cameraConnected, setCameraConnected,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => useContext(AppContext);
