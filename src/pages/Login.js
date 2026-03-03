import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import styles from './Login.module.css';

function Field({ label, id, type='text', value, onChange, placeholder, required }) {
  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={id}>{label}</label>
      <input id={id} type={type} className={styles.input}
        value={value} onChange={onChange} placeholder={placeholder} required={required} />
    </div>
  );
}

export default function Login() {
  const { doLogin, doRegister, showToast, FIREBASE_CONFIGURED, EMAIL_CONFIGURED } = useApp();
  const navigate = useNavigate();
  const [tab, setTab] = useState('login');
  const [loading, setLoading] = useState(false);

  const [loginForm, setLoginForm] = useState({ email: 'demo@crashguard.ai', password: 'demo1234' });
  const [regForm, setRegForm] = useState({
    name:'', email:'', phone:'', password:'',
    emergencyEmail:'', emergencyName:'', plate:'',
    dispatcherEmail:'', dispatcherName:'',
    vehicle:'', vehicleColor:'', blood:'O+',
  });

  const setL = k => e => setLoginForm(p=>({...p,[k]:e.target.value}));
  const setR = k => e => setRegForm(p=>({...p,[k]:e.target.value}));

  const handleLogin = async e => {
    e.preventDefault();
    if (!loginForm.email || !loginForm.password) { showToast('Fill all fields','error'); return; }
    setLoading(true);
    try {
      await doLogin(loginForm.email, loginForm.password);
      navigate('/dashboard');
    } catch(err) {
      showToast(err.message || 'Login failed', 'error');
    } finally { setLoading(false); }
  };

  const handleRegister = async e => {
    e.preventDefault();
    if (!regForm.name || !regForm.email || !regForm.password) {
      showToast('Name, email, and password required','error'); return;
    }
    setLoading(true);
    try {
      await doRegister(regForm.email, regForm.password, regForm);
      showToast('✓ Account created!','success');
      navigate('/dashboard');
    } catch(err) {
      showToast(err.message || 'Registration failed','error');
    } finally { setLoading(false); }
  };

  return (
    <div className={styles.page}>
      <div className={styles.glow} />
      <div className={styles.card}>
        <div className={styles.brand}>CRASH<span>GUARD</span></div>
        <div className={styles.brandSub}>AI Emergency Intelligence System</div>

        {/* Status badges */}
        <div className={styles.badges}>
          <span className={`${styles.badge} ${FIREBASE_CONFIGURED ? styles.badgeGreen : styles.badgeAmber}`}>
            {FIREBASE_CONFIGURED ? '● Firebase Connected' : '● Firebase: Demo Mode'}
          </span>
          <span className={`${styles.badge} ${EMAIL_CONFIGURED ? styles.badgeGreen : styles.badgeAmber}`}>
            {EMAIL_CONFIGURED ? '● EmailJS Ready' : '● Email: Simulated'}
          </span>
        </div>

        <div className={styles.tabs}>
          <button className={`${styles.tab} ${tab==='login'?styles.tabActive:''}`} onClick={()=>setTab('login')}>Sign In</button>
          <button className={`${styles.tab} ${tab==='register'?styles.tabActive:''}`} onClick={()=>setTab('register')}>Register</button>
        </div>

        {tab === 'login' && (
          <form onSubmit={handleLogin}>
            <Field label="Email" id="le" type="email" value={loginForm.email} onChange={setL('email')} placeholder="you@example.com" />
            <Field label="Password" id="lp" type="password" value={loginForm.password} onChange={setL('password')} placeholder="••••••••" />
            <button type="submit" className={styles.btnPrimary} disabled={loading}>
              {loading ? <span className={styles.spinner}/> : null} Access System
            </button>
            {!FIREBASE_CONFIGURED && (
              <p className={styles.hint}>Demo mode: any email + password works</p>
            )}
          </form>
        )}

        {tab === 'register' && (
          <form onSubmit={handleRegister}>
            <div className={styles.grid2}>
              <Field label="Full Name *" id="rn" value={regForm.name} onChange={setR('name')} placeholder="Revathy Kumar" />
              <Field label="Email *" id="re" type="email" value={regForm.email} onChange={setR('email')} placeholder="you@example.com" />
              <Field label="Phone" id="rph" type="tel" value={regForm.phone} onChange={setR('phone')} placeholder="+65 9123 4567" />
              <div className={styles.field}>
                <label className={styles.label} htmlFor="rb">Blood Type</label>
                <select id="rb" className={styles.input} value={regForm.blood} onChange={setR('blood')}>
                  {['A+','A-','B+','B-','O+','O-','AB+','AB-'].map(b=><option key={b}>{b}</option>)}
                </select>
              </div>
              <Field label="Emergency Contact Email" id="rec" type="email" value={regForm.emergencyEmail} onChange={setR('emergencyEmail')} placeholder="family@example.com" />
              <Field label="Emergency Contact Name" id="ren" value={regForm.emergencyName} onChange={setR('emergencyName')} placeholder="Parent Name" />
              <Field label="Dispatcher Email" id="rde" type="email" value={regForm.dispatcherEmail} onChange={setR('dispatcherEmail')} placeholder="dispatch@example.com" />
              <Field label="Dispatcher Name" id="rdn" value={regForm.dispatcherName} onChange={setR('dispatcherName')} placeholder="Local Dispatch" />
              <Field label="License Plate" id="rpl" value={regForm.plate} onChange={setR('plate')} placeholder="SKZ 1234 A" />
              <Field label="Vehicle" id="rv" value={regForm.vehicle} onChange={setR('vehicle')} placeholder="Toyota Corolla 2023" />
            </div>
            <div style={{marginTop:12}}>
              <Field label="Password *" id="rpw" type="password" value={regForm.password} onChange={setR('password')} placeholder="Min 6 characters" />
            </div>
            <button type="submit" className={styles.btnPrimary} style={{marginTop:16}} disabled={loading}>
              {loading ? <span className={styles.spinner}/> : null} Create Account
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
