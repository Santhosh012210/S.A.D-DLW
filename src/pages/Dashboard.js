import { useState, useRef, useCallback, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { useMotionDetection } from '../hooks/useMotionDetection';
import CrashModal from '../components/CrashModal';
import styles from './Dashboard.module.css';

const PIPE_INIT = [
  { id:'model',    label:'AI Model Loaded (MobileNet Lite)', done:true },
  { id:'offline',  label:'Offline Mode Active',              done:true },
  { id:'motion',   label:'Motion Spike Detection',           done:false },
  { id:'frames',   label:'Keyframe Extraction',              done:false },
  { id:'classify', label:'Severity Classification',          done:false },
  { id:'report',   label:'Emergency Report Generation',      done:false },
  { id:'escalate', label:'Adaptive Escalation',              done:false },
];

export default function Dashboard() {
  const { profile, incidents, setCameraConnected, showToast, FIREBASE_CONFIGURED, EMAIL_CONFIGURED } = useApp();
  const videoRef   = useRef(null);
  const streamRef  = useRef(null);
  const crashLockRef = useRef(false); // prevent double-trigger

  const [cameraOn,    setCameraOn]    = useState(false);
  const [modalOpen,   setModalOpen]   = useState(false);
  const [pipeSteps,   setPipeSteps]   = useState(PIPE_INIT);
  const [aiProgress,  setAiProgress]  = useState(0);
  const [aiLabel,     setAiLabel]     = useState('Awaiting event trigger...');
  const [sysStatus,   setSysStatus]   = useState('nominal');
  const [time,        setTime]        = useState('');

  useEffect(() => {
    const t = setInterval(() => setTime(new Date().toLocaleTimeString('en-SG',{hour12:false})), 1000);
    return () => clearInterval(t);
  }, []);

  // ── real motion detection callback ───────────────────────────────────────
  const handleCrashDetected = useCallback(({ motionLevel }) => {
    if (crashLockRef.current || modalOpen) return;
    crashLockRef.current = true;
    showToast(`⚡ Motion spike detected: ${motionLevel.toFixed(0)}%`, 'error');
    triggerCrashSequence();
  }, [modalOpen]); // eslint-disable-line

  const { motionLevel, motionHistory, start: startMotion, stop: stopMotion } =
    useMotionDetection({ videoRef, onCrashDetected: handleCrashDetected, enabled: cameraOn });

  // idle random motion when no camera
  const [idleMotion, setIdleMotion] = useState(8);
  useEffect(() => {
    if (cameraOn) return;
    const t = setInterval(() => setIdleMotion(4 + Math.random() * 14), 500);
    return () => clearInterval(t);
  }, [cameraOn]);

  const displayMotion = cameraOn ? motionLevel : idleMotion;

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode:'user', width:640, height:360 } });
      streamRef.current = stream;
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      setCameraOn(true);
      setCameraConnected(true);
      startMotion();
      showToast('✓ Webcam connected — motion detection active', 'success');
    } catch {
      showToast('Camera permission denied — using simulation mode', 'warn');
    }
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraOn(false);
    setCameraConnected(false);
    stopMotion();
    showToast('Camera disconnected', 'warn');
  };

  const triggerCrashSequence = () => {
    setSysStatus('alert');
    setModalOpen(true);
    const pipeIds = ['motion','frames','classify','report','escalate'];
    pipeIds.forEach((id, i) => {
      setTimeout(() => {
        setPipeSteps(prev => prev.map(s => s.id===id ? {...s, done:true} : s));
        setAiProgress(Math.round(((i+1)/pipeIds.length)*100));
        setAiLabel(['Motion spike!','Extracting keyframes...','Classifying...','Generating report...','Dispatching...'][i]);
      }, i * 480);
    });
  };

  const handleModalClose = () => {
    setModalOpen(false);
    crashLockRef.current = false;
    setSysStatus('nominal');
    setPipeSteps(PIPE_INIT);
    setAiProgress(0);
    setAiLabel('Awaiting event trigger...');
  };

  const handleSent = () => {
    setSysStatus('dispatched');
    setTimeout(() => { setSysStatus('nominal'); setPipeSteps(PIPE_INIT); setAiProgress(0); setAiLabel('Awaiting event trigger...'); crashLockRef.current = false; }, 5000);
  };

  const motionColor = displayMotion > 68 ? 'var(--red)' : displayMotion > 38 ? 'var(--amber)' : 'var(--green)';
  const statusColor = { nominal:'var(--green)', alert:'var(--red)', dispatched:'var(--amber)' }[sysStatus];
  const statusLabel = { nominal:'SYSTEM NOMINAL', alert:'CRASH DETECTED', dispatched:'REPORT DISPATCHED' }[sysStatus];
  const last = incidents[0];

  return (
    <div className={styles.page}>

      {/* ── status bar ── */}
      <div className={styles.statusBar}>
        <span className={styles.dot} style={{background:statusColor}} />
        <span style={{color:statusColor, fontFamily:'var(--font-mono)', fontSize:'0.72rem'}}>{statusLabel}</span>
        <span className={styles.sep}/>
        <span className={styles.barItem}>{time}</span>
        <span className={styles.sep}/>
        <span className={styles.barItem}>GPS: 1.3521° N, 103.8198° E</span>
        <span className={styles.sep}/>
        <span className={styles.barItem} style={{color: cameraOn?'var(--green)':'var(--muted)'}}>
          Dashcam: {cameraOn ? 'Connected' : 'Disconnected'}
        </span>
        <span className={styles.sep}/>
        <span className={`${styles.barItem} ${FIREBASE_CONFIGURED ? styles.green : styles.amber}`}>
          DB: {FIREBASE_CONFIGURED ? 'Firebase' : 'LocalStorage'}
        </span>
        <span className={styles.sep}/>
        <span className={`${styles.barItem} ${EMAIL_CONFIGURED ? styles.green : styles.amber}`}>
          Email: {EMAIL_CONFIGURED ? 'EmailJS' : 'Simulated'}
        </span>
      </div>

      {/* ── stat cards ── */}
      <div className={styles.statRow}>
        {[
          { label:'System Status',   value:'ACTIVE',                  sub:'AI model loaded offline',        accent:'var(--green)' },
          { label:'Total Incidents', value:incidents.length,          sub:'Saved to ' + (FIREBASE_CONFIGURED?'Firestore':'LocalStorage'), accent:'var(--blue)' },
          { label:'Last Severity',
            value: last ? last.severity?.toUpperCase() : '—',
            sub:   last ? new Date(last.timestamp).toLocaleTimeString('en-SG') : 'No events yet',
            accent: last ? ({minor:'var(--green)',moderate:'var(--amber)',severe:'var(--red)'}[last.severity]||'var(--muted)') : 'var(--muted)' },
        ].map(s=>(
          <div key={s.label} className={styles.stat}>
            <div className={styles.statLabel}>{s.label}</div>
            <div className={styles.statValue} style={{color:s.accent}}>{s.value}</div>
            <div className={styles.statSub}>{s.sub}</div>
            <div className={styles.statLine} style={{background:s.accent}}/>
          </div>
        ))}
      </div>

      {/* ── main grid ── */}
      <div className={styles.grid}>

        {/* camera panel */}
        <div>
          <div className={styles.sectionLabel}>Live Camera Feed</div>
          <div className={styles.cameraBox}>
            <video ref={videoRef} autoPlay muted playsInline className={styles.video}
              style={{display: cameraOn?'block':'none'}}/>
            {!cameraOn && (
              <div className={styles.placeholder}>
                <div className={styles.placeholderIcon}>◉</div>
                <div>Camera not connected</div>
                <div className={styles.placeholderSub}>Click "Enable Camera" below</div>
              </div>
            )}
            <div className={`${styles.corner} ${styles.tl}`}/>
            <div className={`${styles.corner} ${styles.tr}`}/>
            <div className={`${styles.corner} ${styles.bl}`}/>
            <div className={`${styles.corner} ${styles.br}`}/>
            <div className={styles.recBadge}>
              <span className={styles.recDot} style={{background: cameraOn?'var(--red)':'var(--muted)'}}/>
              {cameraOn ? 'LIVE' : 'STANDBY'}
            </div>
            <div className={styles.timestamp}>{time}</div>
          </div>

          {/* motion bar */}
          <div className={styles.motionRow}>
            <span className={styles.motionLbl}>MOTION</span>
            <div className={styles.motionTrack}>
              <div className={styles.motionFill} style={{width:`${displayMotion}%`, background:motionColor}}/>
            </div>
            <span className={styles.motionPct} style={{color:motionColor}}>{Math.round(displayMotion)}%</span>
          </div>

          {/* waveform */}
          <div className={styles.waveform}>
            {motionHistory.map((v,i) => (
              <div key={i} className={styles.waveBar}
                style={{height:`${Math.max(2, v * 0.5)}px`,
                  background: v>68?'var(--red)':v>38?'var(--amber)':'var(--green)',
                  opacity: 0.4 + (i/60)*0.6}}/>
            ))}
          </div>

          <div className={styles.controls}>
            <button className={`${styles.btn} ${styles.btnOutline}`} onClick={cameraOn?stopCamera:startCamera}>
              {cameraOn ? '⊗ Disconnect' : '⊕ Enable Camera'}
            </button>
            <button className={`${styles.btn} ${styles.btnDanger}`} onClick={() => { crashLockRef.current=false; triggerCrashSequence(); }}>
              ⚠ Simulate Crash
            </button>
          </div>
        </div>

        {/* pipeline panel */}
        <div>
          <div className={styles.sectionLabel}>AI Processing Pipeline</div>
          <div className={styles.card}>
            {pipeSteps.map(s=>(
              <div key={s.id} className={`${styles.pStep} ${s.done?styles.pDone:''}`}>
                <div className={styles.pDot}>{s.done ? '✓' : '○'}</div>
                <span>{s.label}</span>
              </div>
            ))}
            <div style={{marginTop:14}}>
              <div className={styles.progressBar}>
                <div className={styles.progressFill} style={{width:`${aiProgress}%`}}/>
              </div>
              <div className={styles.progressLabel}>{aiLabel}</div>
            </div>
          </div>

          <div className={styles.sectionLabel} style={{marginTop:16}}>Impact Visualization</div>
          <div className={styles.impactCard}>
            <div className={styles.impactWrap}>
              <span className={`${styles.impactCar} ${sysStatus==='alert'?styles.shake:''}`}>🚗</span>
              {sysStatus==='alert' && <>
                <div className={styles.ring}/>
                <div className={styles.ring2}/>
              </>}
            </div>
            <div className={styles.impactLabel}>
              {sysStatus==='alert' ? '⚡ Impact detected — AI analyzing...'
                : sysStatus==='dispatched' ? '✓ Report dispatched'
                : 'No impact detected'}
            </div>
          </div>
        </div>
      </div>

      <CrashModal open={modalOpen} onClose={handleModalClose} onSent={handleSent}/>
    </div>
  );
}
