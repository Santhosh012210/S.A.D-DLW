import { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import styles from './CrashModal.module.css';

const SEVERITY_MAP = {
  minor:    { label:'MINOR COLLISION',    color:'var(--green)', bg:'rgba(34,197,94,0.12)',    score:0.22 },
  moderate: { label:'MODERATE COLLISION', color:'var(--amber)', bg:'rgba(245,158,11,0.12)',   score:0.61 },
  severe:   { label:'SEVERE COLLISION',   color:'var(--red)',   bg:'rgba(232,48,42,0.12)',    score:0.91 },
};
const SUMMARIES = {
  minor:    'Low-impact collision detected. Slight deceleration spike observed. Airbags not deployed. Driver should assess surroundings. Medical check recommended as precaution.',
  moderate: 'Moderate-impact collision detected. Significant deceleration observed. Front sensor impact confirmed. Structural damage likely. Medical assessment strongly recommended.',
  severe:   'High-impact frontal collision detected. Severe deceleration spike recorded. No post-impact movement observed. Airbag deployment likely. Immediate emergency medical response required.',
};
const AI_STEPS = [
  'Extracting keyframes from buffered footage...',
  'Computing optical flow motion vectors...',
  'Running MobileNet severity classifier...',
  'Generating structured emergency report...',
  'Preparing adaptive escalation packet...',
];

export default function CrashModal({ open, onClose, onSent }) {
  const { profile, addIncident, sendReport, showToast, FIREBASE_CONFIGURED, EMAIL_CONFIGURED } = useApp();
  const [phase,    setPhase]    = useState('processing');
  const [stepIdx,  setStepIdx]  = useState(0);
  const [progress, setProgress] = useState(0);
  const [severity, setSeverity] = useState('severe');
  const [sending,  setSending]  = useState(false);

  useEffect(() => {
    if (!open) return;
    setPhase('processing');
    setStepIdx(0);
    setProgress(0);
    const sev = ['minor','moderate','severe'][Math.floor(Math.random()*3)];
    setSeverity(sev);
    let step = 0;
    const iv = setInterval(() => {
      step++;
      setStepIdx(step);
      setProgress(Math.round((step/AI_STEPS.length)*100));
      if (step >= AI_STEPS.length) { clearInterval(iv); setTimeout(()=>setPhase('report'),300); }
    }, 650);
    return () => clearInterval(iv);
  }, [open]);

  const handleSend = async () => {
    setSending(true);
    const incident = {
      timestamp: new Date().toISOString(),
      severity,
      score: SEVERITY_MAP[severity].score,
      summary: SUMMARIES[severity],
      gps: { lat:1.3521, lng:103.8198 },
      location: 'Buona Vista, Singapore',
      user: { ...profile },
    };
    try {
      // 1) save to Firebase / localStorage
      await addIncident(incident);
      const dbLabel = FIREBASE_CONFIGURED ? 'Firebase' : 'LocalStorage';
      showToast(`✓ Incident saved to ${dbLabel}`, 'success');
      // 2) send email
      const emailResult = await sendReport(incident);
      if (emailResult.real) {
        showToast(`📧 Real email sent to ${profile.emergencyEmail}`, 'success');
      } else {
        showToast(`📧 Email simulated → add EmailJS keys to .env`, 'warn');
      }
      // 3) dispatcher toast
      setTimeout(()=>showToast('📡 Dispatcher report transmitted','success'), 600);
    } catch(err) {
      showToast('Error: ' + (err.message||'Unknown error'), 'error');
    }
    setSending(false);
    onSent?.();
    onClose();
  };

  if (!open) return null;

  const sev = SEVERITY_MAP[severity];
  const ts  = new Date().toLocaleString('en-SG');

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <span className={styles.headerIcon}>⚠</span>
          <div>
            <div className={styles.headerTitle}>CRASH DETECTED</div>
            <div className={styles.headerSub}>On-device AI analysis running</div>
          </div>
          <div className={styles.pulse}/>
        </div>

        <div className={styles.body}>
          {phase === 'processing' && (
            <div>
              <div className={styles.progressBar}><div className={styles.progressFill} style={{width:`${progress}%`}}/></div>
              <div className={styles.steps}>
                {AI_STEPS.map((s,i)=>(
                  <div key={i} className={`${styles.step} ${i<stepIdx?styles.done:i===stepIdx?styles.active:''}`}>
                    <div className={styles.stepDot}>
                      {i<stepIdx ? '✓' : i===stepIdx ? <span className={styles.spinner}/> : '○'}
                    </div>
                    <span>{s}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {phase === 'report' && (
            <div>
              <div className={styles.sevRow}>
                <span className={styles.sevBadge}
                  style={{color:sev.color, background:sev.bg, border:`1px solid ${sev.color}`}}>
                  ⬡ {sev.label}
                </span>
                <span className={styles.confidence}>Confidence: {Math.round(sev.score*100)}%</span>
              </div>

              <div className={styles.reportGrid}>
                {[
                  ['Driver',    profile.name||'—'],
                  ['Phone',     profile.phone||'—'],
                  ['Plate',     profile.plate||'—'],
                  ['Blood',     profile.blood||'—'],
                  ['Vehicle',   profile.vehicle||'—'],
                  ['Timestamp', ts],
                  ['GPS',       '1.3521°N, 103.8198°E'],
                  ['Location',  'Buona Vista, SG'],
                ].map(([k,v])=>(
                  <div key={k} className={styles.field}>
                    <div className={styles.fieldLabel}>{k}</div>
                    <div className={styles.fieldValue}>{v}</div>
                  </div>
                ))}
              </div>

              <div className={styles.summaryLabel}>AI Generated Summary</div>
              <div className={styles.summary} style={{borderLeftColor:sev.color}}>{SUMMARIES[severity]}</div>

              <div className={styles.impactViz}>
                <span className={styles.impactCar}>🚗</span>
                <div className={styles.ring}/><div className={styles.ring2}/>
              </div>

              {/* backend status row */}
              <div className={styles.backendRow}>
                <span className={`${styles.beTag} ${FIREBASE_CONFIGURED?styles.beGreen:styles.beAmber}`}>
                  {FIREBASE_CONFIGURED ? '● Firestore' : '● LocalStorage'}
                </span>
                <span className={`${styles.beTag} ${EMAIL_CONFIGURED?styles.beGreen:styles.beAmber}`}>
                  {EMAIL_CONFIGURED ? '● EmailJS Ready' : '● Email Simulated'}
                </span>
              </div>

              <div className={styles.actions}>
                <button className={`${styles.btn} ${styles.btnDanger}`} onClick={handleSend} disabled={sending}>
                  {sending ? <span className={styles.spinner}/> : '📡'} Send Emergency Report
                </button>
                <button className={`${styles.btn} ${styles.btnOutline}`} onClick={onClose}>Dismiss</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
