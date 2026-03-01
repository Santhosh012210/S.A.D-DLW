import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider, useApp } from './context/AppContext';
import Login from './pages/Login';
import AppLayout from './pages/AppLayout';
import Dashboard from './pages/Dashboard';
import Dashcam from './pages/Dashcam';
import History from './pages/History';
import Profile from './pages/Profile';
import ToastContainer from './components/Toast';

function ProtectedRoute({ children }) {
  const { isLoggedIn, authReady } = useApp();
  if (!authReady) return <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',fontFamily:'var(--font-mono)',fontSize:'0.7rem',color:'var(--muted)'}}>Initializing...</div>;
  return isLoggedIn ? children : <Navigate to="/login" replace />;
}

function AppRoutes() {
  const { isLoggedIn, authReady } = useApp();
  if (!authReady) return null;
  return (
    <Routes>
      <Route path="/login" element={isLoggedIn ? <Navigate to="/dashboard" /> : <Login />} />
      <Route path="/" element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
        <Route index element={<Navigate to="/dashboard" />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="dashcam"   element={<Dashcam />} />
        <Route path="history"   element={<History />} />
        <Route path="profile"   element={<Profile />} />
      </Route>
      <Route path="*" element={<Navigate to="/login" />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <AppRoutes />
        <ToastContainer />
      </BrowserRouter>
    </AppProvider>
  );
}
