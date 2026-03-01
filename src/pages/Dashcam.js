import { useState } from 'react';
import { useApp } from '../context/AppContext';
import styles from './Dashcam.module.css';

export default function Dashcam() {
  const { cameraConnected, showToast } = useApp();
  const [cfg, setCfg] = useState({ gThreshold:'2.5', motion:'68', buffer:'10', escalation:'Moderate & Above', quality:'High (720p)', offline:true, autoEscalate:true });
  const set = k => e => setCfg(p=>({...p,[k]:e.target.value}));
  const tog = k => () => setCfg(p=>({...p,[k]:!p[k]}));

  return (
    <div>
      <div className={styles.header}>
        <div className={styles.title}>DASHCAM</div>
        <div className={styles.sub}>Device Connection &amp; Configuration</div>
      </div>

      <div className={styles.grid}>
        <div>
          <div className={styles.sectionLabel}>Available Devices</div>
          <div className={styles.card}>
            {[
              { icon:'📷', name:'Laptop Webcam (Simulated Dashcam)', status: cameraConnected?'● Connected — Live Feed Active':'○ Not connected', color:cameraConnected?'var(--green)':'var(--muted)', action:'Go to Dashboard', onClick:()=>showToast('Enable camera from the Dashboard tab','warn') },
              { icon:'📡', name:'CrashGuard Pro Dashcam (BLE)', status:'Scanning for Bluetooth...', color:'var(--muted)', action:'Pair', onClick:()=>showToast('BLE pairing available in production','warn') },
              { icon:'🌐', name:'IP Camera (Wi-Fi / RTSP)', status:'Enter RTSP URL to configure', color:'var(--muted)', action:'Configure', onClick:()=>showToast('RTSP streams supported in production','warn') },
            ].map(d=>(
              <div key={d.name} className={styles.device}>
                <div className={styles.deviceIcon}>{d.icon}</div>
                <div className={styles.deviceInfo}>
                  <div className={styles.deviceName}>{d.name}</div>
                  <div className={styles.deviceStatus} style={{color:d.color}}>{d.status}</div>
                </div>
                <button className={styles.actionBtn} onClick={d.onClick}>{d.action}</button>
              </div>
            ))}
            <div style={{marginTop:14}}>
              <button className={styles.testBtn} onClick={async()=>{
                showToast('Testing...','warn');
                await new Promise(r=>setTimeout(r,1000));
                if(cameraConnected) showToast('✓ Connection verified','success');
                else showToast('Not connected — enable from Dashboard','error');
              }}>Test Connection</button>
            </div>
          </div>
        </div>

        <div>
          <div className={styles.sectionLabel}>Sensor Thresholds</div>
          <div className={styles.card} style={{marginBottom:16}}>
            <div className={styles.cfgGrid}>
              {[
                {label:'G-Sensor Crash Threshold (g)',id:'gc',k:'gThreshold',type:'number'},
                {label:'Motion Spike Trigger (%)',id:'ms',k:'motion',type:'number'},
                {label:'Pre-crash Buffer (s)',id:'pb',k:'buffer',type:'number'},
              ].map(f=>(
                <div key={f.k} className={styles.field}>
                  <label className={styles.label}>{f.label}</label>
                  <input id={f.id} type={f.type} className={styles.input} value={cfg[f.k]} onChange={set(f.k)}/>
                </div>
              ))}
              <div className={styles.field}>
                <label className={styles.label}>Escalation Threshold</label>
                <select className={styles.input} value={cfg.escalation} onChange={set('escalation')}>
                  {['Minor (All)','Moderate & Above','Severe Only'].map(o=><option key={o}>{o}</option>)}
                </select>
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Recording Quality</label>
                <select className={styles.input} value={cfg.quality} onChange={set('quality')}>
                  {['Low (480p)','Medium (540p)','High (720p)','Max (1080p)'].map(o=><option key={o}>{o}</option>)}
                </select>
              </div>
            </div>
          </div>

          <div className={styles.sectionLabel}>System Flags</div>
          <div className={styles.card}>
            {[
              {k:'offline',    label:'Offline AI Mode',    sub:'Run all inference on device without internet'},
              {k:'autoEscalate',label:'Auto Escalation',   sub:'Auto-send report when threshold exceeded'},
            ].map(f=>(
              <div key={f.k} className={styles.toggle}>
                <div>
                  <div className={styles.tLabel}>{f.label}</div>
                  <div className={styles.tSub}>{f.sub}</div>
                </div>
                <div className={`${styles.switch} ${cfg[f.k]?styles.on:''}`} onClick={tog(f.k)}>
                  <div className={styles.thumb}/>
                </div>
              </div>
            ))}
            <button className={styles.saveBtn} onClick={()=>showToast('✓ Configuration saved','success')} style={{marginTop:14}}>
              Save Configuration
            </button>
          </div>
        </div>
      </div>

      {/* architecture */}
      <div style={{marginTop:24}}>
        <div className={styles.sectionLabel}>System Architecture — End-to-End Flow</div>
        <div className={styles.arch}>
          {[
            {icon:'📷',label:'Dashcam / Webcam',sub:'G-sensor + video'},
            {icon:'⚡',label:'Crash Trigger',sub:'Motion spike detect'},
            {icon:'📱',label:'Local AI Engine',sub:'MobileNet on-device'},
            {icon:'📊',label:'Severity Report',sub:'Structured data'},
            {icon:'📡',label:'Dispatcher + Email',sub:'Adaptive escalation'},
          ].map((n,i)=>(
            <div key={i} className={styles.archStep}>
              <div className={styles.archBox}>
                <div className={styles.archIcon}>{n.icon}</div>
                <div className={styles.archLabel}>{n.label}</div>
                <div className={styles.archSub}>{n.sub}</div>
              </div>
              {i<4 && <div className={styles.archArrow}>→</div>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
