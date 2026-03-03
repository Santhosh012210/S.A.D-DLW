import { useState, useRef, useCallback, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { useMotionDetection } from '../hooks/useMotionDetection';
import CrashModal from '../components/CrashModal';
import styles from './Dashboard.module.css';

const PIPE_INIT = [
  { id: 'model', label: 'AI Model Loaded', done: true },
  { id: 'offline', label: 'Offline Mode Active', done: true },
  { id: 'motion', label: 'Motion Spike Detection', done: false },
  { id: 'frames', label: 'Keyframe Extraction', done: false },
  { id: 'classify', label: 'Severity Classification', done: false },
  { id: 'report', label: 'Emergency Report Generation', done: false },
  { id: 'escalate', label: 'Adaptive Escalation', done: false },
];

const ANALYSIS_PROVIDER = String(process.env.REACT_APP_ANALYSIS_PROVIDER || 'auto').toLowerCase();
const MODEL_ANALYZE_URL = process.env.REACT_APP_CRASH_MODEL_URL || 'http://127.0.0.1:5000/analyze';
const MODEL_HEALTH_URL = process.env.REACT_APP_CRASH_MODEL_HEALTH_URL || 'http://127.0.0.1:5000/health';
const MODERATE_TRIGGER_MIN_CONF = 0.65;
const SEVERE_TRIGGER_MIN_CONF = 0.8;
const FRAME_WIDTH = 640;
const FRAME_HEIGHT = 360;

function normalizeConfidence(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n > 1 ? n / 100 : n));
}

function toCameraErrorMessage(err) {
  const name = String(err?.name || '');
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
    const secureHint = !window.isSecureContext && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1'
      ? ' Open from https://... or http://localhost.'
      : '';
    return `Camera access blocked by browser settings.${secureHint}`;
  }
  if (name === 'NotReadableError' || name === 'TrackStartError') {
    return 'Camera is in use by another app (Zoom/Teams/Camera). Close it and retry.';
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
    return 'No camera device found.';
  }
  if (name === 'OverconstrainedError' || name === 'ConstraintNotSatisfiedError') {
    return 'Requested camera constraints are not supported.';
  }
  return `Camera error: ${name || 'Unknown'}`;
}

export default function Dashboard() {
  const { incidents, setCameraConnected, showToast, FIREBASE_CONFIGURED, EMAIL_CONFIGURED } = useApp();
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const snapshotCanvasRef = useRef(null);
  const crashLockRef = useRef(false);
  const modelPollRef = useRef(null);
  const modelBusyRef = useRef(false);

  const [cameraOn, setCameraOn] = useState(false);
  const [modelOnline, setModelOnline] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [pipeSteps, setPipeSteps] = useState(PIPE_INIT);
  const [aiProgress, setAiProgress] = useState(0);
  const [aiLabel, setAiLabel] = useState('Awaiting event trigger...');
  const [sysStatus, setSysStatus] = useState('nominal');
  const [time, setTime] = useState('');
  const [modelScore, setModelScore] = useState(0);
  const [modelHistory, setModelHistory] = useState(Array(60).fill(0));
  const [modelDetections, setModelDetections] = useState([]);
  const [detectedSeverity, setDetectedSeverity] = useState('severe');
  const [detectedScore, setDetectedScore] = useState(0.9);
  const [detectedSnapshot, setDetectedSnapshot] = useState('');

  useEffect(() => {
    const t = setInterval(() => setTime(new Date().toLocaleTimeString('en-SG', { hour12: false })), 1000);
    snapshotCanvasRef.current = document.createElement('canvas');
    snapshotCanvasRef.current.width = FRAME_WIDTH;
    snapshotCanvasRef.current.height = FRAME_HEIGHT;
    return () => clearInterval(t);
  }, []);

  const triggerCrashSequence = useCallback(({ severity = 'severe', score = 0.9, snapshot = '' } = {}) => {
    setDetectedSeverity(severity);
    setDetectedScore(score);
    setDetectedSnapshot(snapshot || '');
    setSysStatus('alert');
    setModalOpen(true);
    const pipeIds = ['motion', 'frames', 'classify', 'report', 'escalate'];
    const labels = ['Spike detected', 'Extracting keyframes...', 'Classifying...', 'Generating report...', 'Dispatching...'];
    pipeIds.forEach((id, i) => {
      setTimeout(() => {
        setPipeSteps((prev) => prev.map((s) => (s.id === id ? { ...s, done: true } : s)));
        setAiProgress(Math.round(((i + 1) / pipeIds.length) * 100));
        setAiLabel(labels[i]);
      }, i * 480);
    });
  }, []);

  const { motionLevel, motionHistory, start: startMotion, stop: stopMotion } =
    useMotionDetection({ videoRef, onCrashDetected: null, enabled: cameraOn });

  const [idleMotion, setIdleMotion] = useState(8);
  useEffect(() => {
    if (cameraOn) return;
    const t = setInterval(() => setIdleMotion(4 + Math.random() * 14), 500);
    return () => clearInterval(t);
  }, [cameraOn]);

  const stopModelPolling = useCallback(() => {
    if (modelPollRef.current) {
      clearInterval(modelPollRef.current);
      modelPollRef.current = null;
    }
  }, []);

  const captureFrameDataUrl = useCallback(({ width = FRAME_WIDTH, height = FRAME_HEIGHT, quality = 0.72 } = {}) => {
    const video = videoRef.current;
    const canvas = snapshotCanvasRef.current;
    if (!video || !canvas || video.readyState < 2) return '';
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return '';
    canvas.width = width;
    canvas.height = height;
    ctx.drawImage(video, 0, 0, width, height);
    return canvas.toDataURL('image/jpeg', quality);
  }, []);

  const startModelPolling = useCallback(() => {
    stopModelPolling();
    modelPollRef.current = setInterval(async () => {
      if (modelBusyRef.current || crashLockRef.current || modalOpen) return;
      modelBusyRef.current = true;
      try {
        const imageData = captureFrameDataUrl({ width: FRAME_WIDTH, height: FRAME_HEIGHT, quality: 0.72 });
        if (!imageData) return;

        const response = await fetch(MODEL_ANALYZE_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageData }),
        });
        if (!response.ok) return;

        const analysis = await response.json();
        const confidence = normalizeConfidence(analysis?.confidenceScore);
        const confidencePct = Math.round(confidence * 100);
        const severityLevel = String(analysis?.severityLevel || '').toUpperCase();
        setModelScore(confidencePct);
        setModelHistory((prev) => [...prev.slice(1), confidencePct]);
        setModelDetections(Array.isArray(analysis?.detections) ? analysis.detections : []);

        const moderateCrash = analysis?.crashDetected && severityLevel === 'MEDIUM' && confidence >= MODERATE_TRIGGER_MIN_CONF;
        const severeCrash = analysis?.crashDetected && severityLevel === 'HIGH' && confidence >= SEVERE_TRIGGER_MIN_CONF;
        if (moderateCrash || severeCrash) {
          crashLockRef.current = true;
          const uiSeverity = severeCrash ? 'severe' : 'moderate';
          const label = severeCrash ? 'Severe' : 'Moderate';
          showToast(`${label} crash detected: ${confidencePct}% confidence`, 'error');
          triggerCrashSequence({
            severity: uiSeverity,
            score: confidence,
            snapshot: captureFrameDataUrl({ width: 320, height: 180, quality: 0.5 }),
          });
        }
      } catch {
        // Ignore transient errors and continue polling.
      } finally {
        modelBusyRef.current = false;
      }
    }, 1400);
  }, [captureFrameDataUrl, modalOpen, showToast, stopModelPolling, triggerCrashSequence]);

  const startCamera = async () => {
    try {
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: 640, height: 360 },
        });
      } catch (primaryErr) {
        if (String(primaryErr?.name || '') === 'OverconstrainedError') {
          stream = await navigator.mediaDevices.getUserMedia({ video: true });
        } else {
          throw primaryErr;
        }
      }
      streamRef.current = stream;
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      setCameraOn(true);
      setCameraConnected(true);
      startMotion();
      showToast('Webcam connected', 'success');

      const useModel = ANALYSIS_PROVIDER === 'local_model' || ANALYSIS_PROVIDER === 'auto';
      if (useModel) {
        try {
          const response = await fetch(MODEL_HEALTH_URL);
          const health = response.ok ? await response.json() : null;
          const online = Boolean(health?.ok);
          setModelOnline(online);
          if (online) {
            showToast('Model analysis active', 'success');
          } else {
            showToast('Model server unavailable. Running camera only.', 'warn');
          }
        } catch {
          setModelOnline(false);
          showToast('Model server unavailable. Running camera only.', 'warn');
        }
      }
    } catch (err) {
      showToast(toCameraErrorMessage(err), 'warn');
    }
  };

  const stopCamera = () => {
    stopModelPolling();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraOn(false);
    setCameraConnected(false);
    setModelOnline(false);
    setModelDetections([]);
    stopMotion();
    setModelScore(0);
    setModelHistory(Array(60).fill(0));
    showToast('Camera disconnected', 'warn');
  };

  useEffect(() => {
    if (cameraOn && modelOnline) {
      startModelPolling();
      return;
    }
    stopModelPolling();
  }, [cameraOn, modelOnline, startModelPolling, stopModelPolling]);

  useEffect(() => () => stopModelPolling(), [stopModelPolling]);

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
    setTimeout(() => {
      setSysStatus('nominal');
      setPipeSteps(PIPE_INIT);
      setAiProgress(0);
      setAiLabel('Awaiting event trigger...');
      crashLockRef.current = false;
    }, 5000);
  };

  const displaySignal = cameraOn ? (modelOnline ? modelScore : motionLevel) : idleMotion;
  const waveformSeries = modelOnline ? modelHistory : motionHistory;
  const signalLabel = modelOnline ? 'MODEL SCORE' : 'MOTION';
  const signalColor = displaySignal > 68 ? 'var(--red)' : displaySignal > 38 ? 'var(--amber)' : 'var(--green)';
  const statusColor = { nominal: 'var(--green)', alert: 'var(--red)', dispatched: 'var(--amber)' }[sysStatus];
  const statusLabel = { nominal: 'SYSTEM NOMINAL', alert: 'MODERATE/SEVERE CRASH DETECTED', dispatched: 'REPORT DISPATCHED' }[sysStatus];
  const last = incidents[0];

  return (
    <div className={styles.page}>
      <div className={styles.statusBar}>
        <span className={styles.dot} style={{ background: statusColor }} />
        <span style={{ color: statusColor, fontFamily: 'var(--font-mono)', fontSize: '0.72rem' }}>{statusLabel}</span>
        <span className={styles.sep} />
        <span className={styles.barItem}>{time}</span>
        <span className={styles.sep} />
        <span className={styles.barItem}>GPS: 1.3521 N, 103.8198 E</span>
        <span className={styles.sep} />
        <span className={styles.barItem} style={{ color: cameraOn ? 'var(--green)' : 'var(--muted)' }}>
          Dashcam: {cameraOn ? 'Connected' : 'Disconnected'}
        </span>
        <span className={styles.sep} />
        <span className={`${styles.barItem} ${modelOnline ? styles.green : styles.amber}`}>
          Model: {modelOnline ? 'Online' : 'Offline'}
        </span>
        <span className={styles.sep} />
        <span className={`${styles.barItem} ${FIREBASE_CONFIGURED ? styles.green : styles.amber}`}>
          DB: {FIREBASE_CONFIGURED ? 'Firebase' : 'LocalStorage'}
        </span>
        <span className={styles.sep} />
        <span className={`${styles.barItem} ${EMAIL_CONFIGURED ? styles.green : styles.amber}`}>
          Email: {EMAIL_CONFIGURED ? 'EmailJS' : 'Simulated'}
        </span>
      </div>

      <div className={styles.statRow}>
        {[
          { label: 'System Status', value: modelOnline ? 'MONITORING' : 'CAMERA ONLY', sub: 'Moderate+Severe crash trigger enabled', accent: 'var(--green)' },
          { label: 'Total Incidents', value: incidents.length, sub: `Saved to ${FIREBASE_CONFIGURED ? 'Firestore' : 'LocalStorage'}`, accent: 'var(--blue)' },
          {
            label: 'Last Severity',
            value: last ? last.severity?.toUpperCase() : '-',
            sub: last ? new Date(last.timestamp).toLocaleTimeString('en-SG') : 'No events yet',
            accent: last ? ({ minor: 'var(--green)', moderate: 'var(--amber)', severe: 'var(--red)' }[last.severity] || 'var(--muted)') : 'var(--muted)',
          },
        ].map((s) => (
          <div key={s.label} className={styles.stat}>
            <div className={styles.statLabel}>{s.label}</div>
            <div className={styles.statValue} style={{ color: s.accent }}>{s.value}</div>
            <div className={styles.statSub}>{s.sub}</div>
            <div className={styles.statLine} style={{ background: s.accent }} />
          </div>
        ))}
      </div>

      <div className={styles.grid}>
        <div>
          <div className={styles.sectionLabel}>Live Camera Feed</div>
          <div className={styles.cameraBox}>
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className={styles.video}
              style={{ display: cameraOn ? 'block' : 'none' }}
            />
            {cameraOn && modelOnline && (
              <div className={styles.detectionOverlay}>
                {modelDetections.map((det, i) => {
                  const [x1, y1, x2, y2] = Array.isArray(det?.bbox) ? det.bbox : [0, 0, 0, 0];
                  const left = (Math.max(0, x1) / FRAME_WIDTH) * 100;
                  const top = (Math.max(0, y1) / FRAME_HEIGHT) * 100;
                  const width = (Math.max(0, x2 - x1) / FRAME_WIDTH) * 100;
                  const height = (Math.max(0, y2 - y1) / FRAME_HEIGHT) * 100;
                  if (!Number.isFinite(left + top + width + height) || width <= 0 || height <= 0) return null;
                  return (
                    <div
                      key={`${det.label || 'obj'}-${i}`}
                      className={styles.detectionBox}
                      style={{ left: `${left}%`, top: `${top}%`, width: `${width}%`, height: `${height}%` }}
                    >
                      <span className={styles.detectionTag}>
                        {det.label || 'Object'} {Math.round(normalizeConfidence(det.confidence) * 100)}%
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
            {!cameraOn && (
              <div className={styles.placeholder}>
                <div className={styles.placeholderIcon}>O</div>
                <div>Camera not connected</div>
                <div className={styles.placeholderSub}>Click Enable Camera below</div>
              </div>
            )}
            <div className={`${styles.corner} ${styles.tl}`} />
            <div className={`${styles.corner} ${styles.tr}`} />
            <div className={`${styles.corner} ${styles.bl}`} />
            <div className={`${styles.corner} ${styles.br}`} />
            <div className={styles.recBadge}>
              <span className={styles.recDot} style={{ background: cameraOn ? 'var(--red)' : 'var(--muted)' }} />
              {cameraOn ? 'LIVE' : 'STANDBY'}
            </div>
            <div className={styles.timestamp}>{time}</div>
          </div>

          <div className={styles.motionRow}>
            <span className={styles.motionLbl}>{signalLabel}</span>
            <div className={styles.motionTrack}>
              <div className={styles.motionFill} style={{ width: `${displaySignal}%`, background: signalColor }} />
            </div>
            <span className={styles.motionPct} style={{ color: signalColor }}>{Math.round(displaySignal)}%</span>
          </div>

          <div className={styles.waveform}>
            {waveformSeries.map((v, i) => (
              <div
                key={i}
                className={styles.waveBar}
                style={{
                  height: `${Math.max(2, v * 0.5)}px`,
                  background: v > 68 ? 'var(--red)' : v > 38 ? 'var(--amber)' : 'var(--green)',
                  opacity: 0.4 + (i / 60) * 0.6,
                }}
              />
            ))}
          </div>

          <div className={styles.controls}>
            <button className={`${styles.btn} ${styles.btnOutline}`} onClick={cameraOn ? stopCamera : startCamera}>
              {cameraOn ? 'Disconnect' : 'Enable Camera'}
            </button>
            <button className={`${styles.btn} ${styles.btnDanger}`} onClick={() => {
              crashLockRef.current = false;
              triggerCrashSequence({
                severity: 'severe',
                score: 0.95,
                snapshot: captureFrameDataUrl({ width: 320, height: 180, quality: 0.5 }),
              });
            }}>
              Simulate Crash
            </button>
          </div>
        </div>

        <div>
          <div className={styles.sectionLabel}>AI Processing Pipeline</div>
          <div className={styles.card}>
            {pipeSteps.map((s) => (
              <div key={s.id} className={`${styles.pStep} ${s.done ? styles.pDone : ''}`}>
                <div className={styles.pDot}>{s.done ? 'OK' : '...'}</div>
                <span>{s.label}</span>
              </div>
            ))}
            <div style={{ marginTop: 14 }}>
              <div className={styles.progressBar}>
                <div className={styles.progressFill} style={{ width: `${aiProgress}%` }} />
              </div>
              <div className={styles.progressLabel}>{aiLabel}</div>
            </div>
          </div>

          <div className={styles.sectionLabel} style={{ marginTop: 16 }}>Impact Visualization</div>
          <div className={styles.impactCard}>
            <div className={styles.impactWrap}>
              <span className={`${styles.impactCar} ${sysStatus === 'alert' ? styles.shake : ''}`}>CAR</span>
              {sysStatus === 'alert' && (
                <>
                  <div className={styles.ring} />
                  <div className={styles.ring2} />
                </>
              )}
            </div>
            <div className={styles.impactLabel}>
              {sysStatus === 'alert'
                ? 'Severe impact detected - AI analyzing...'
                : sysStatus === 'dispatched'
                  ? 'Report dispatched'
                  : 'No severe impact detected'}
            </div>
          </div>
        </div>
      </div>

      <CrashModal
        open={modalOpen}
        onClose={handleModalClose}
        onSent={handleSent}
        initialSeverity={detectedSeverity}
        initialScore={detectedScore}
        initialSnapshot={detectedSnapshot}
      />
    </div>
  );
}
