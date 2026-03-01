import { useState } from 'react';
import { useApp } from '../context/AppContext';
import styles from './History.module.css';

export default function History() {
  const { incidents, showToast, FIREBASE_CONFIGURED } = useApp();
  const [expanded, setExpanded] = useState(null);

  const counts = { minor:0, moderate:0, severe:0 };
  incidents.forEach(i => { if(counts[i.severity] !== undefined) counts[i.severity]++; });

  return (
    <div>
      <div className={styles.header}>
        <div className={styles.title}>EVENT HISTORY</div>
        <div className={styles.sub}>Previous Crash Events &amp; Reports</div>
        <div className={styles.meta}>
          {incidents.length} incident{incidents.length!==1?'s':''} stored in {FIREBASE_CONFIGURED?'Firestore':'LocalStorage'}
        </div>
      </div>

      {incidents.length === 0 ? (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>◌</div>
          <div className={styles.emptyText}>No crash events recorded</div>
          <div className={styles.emptySub}>Trigger a simulation from Dashboard to generate a record</div>
        </div>
      ) : (
        <>
          <div className={styles.summaryRow}>
            {[
              {k:'minor',    color:'var(--green)'},
              {k:'moderate', color:'var(--amber)'},
              {k:'severe',   color:'var(--red)'},
            ].map(s=>(
              <div key={s.k} className={styles.summaryCard} style={{borderTop:`2px solid ${s.color}`}}>
                <div className={styles.summaryCount}>{counts[s.k]}</div>
                <div className={styles.summaryLabel}>{s.k.toUpperCase()}</div>
              </div>
            ))}
          </div>

          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>#</th><th>Timestamp</th><th>Location</th>
                  <th>Severity</th><th>Confidence</th><th>Summary</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {incidents.map((inc, i) => {
                  const sevColor = {minor:'var(--green)',moderate:'var(--amber)',severe:'var(--red)'}[inc.severity]||'var(--muted)';
                  const ts = inc.timestamp ? new Date(inc.timestamp).toLocaleString('en-SG') : '—';
                  return [
                    <tr key={inc.id||i} className={styles.row} onClick={()=>setExpanded(expanded===inc.id?null:inc.id)}>
                      <td className={styles.num}>{incidents.length-i}</td>
                      <td className={styles.ts}>{ts}</td>
                      <td>{inc.location||'Singapore'}</td>
                      <td>
                        <span className={styles.sevBadge} style={{color:sevColor,border:`1px solid ${sevColor}`,background:`${sevColor}18`}}>
                          {inc.severity?.toUpperCase()}
                        </span>
                      </td>
                      <td className={styles.score}>{Math.round((inc.score||0)*100)}%</td>
                      <td className={styles.summaryCell}>{(inc.summary||'').slice(0,55)}...</td>
                      <td>
                        <button className={styles.dlBtn}
                          onClick={e=>{e.stopPropagation();showToast('✓ Video download initiated (simulated)','success');}}>
                          ⬇ Download
                        </button>
                      </td>
                    </tr>,
                    expanded===inc.id && (
                      <tr key={`e-${inc.id||i}`}>
                        <td colSpan={7}>
                          <div className={styles.expandPanel}>
                            <div className={styles.expandGrid}>
                              <div>
                                <div className={styles.expLabel}>Full AI Summary</div>
                                <div className={styles.expText}>{inc.summary}</div>
                              </div>
                              <div>
                                <div className={styles.expLabel}>Driver</div>
                                <div className={styles.expText}>
                                  {inc.user?.name||'—'}<br/>
                                  {inc.user?.phone||'—'}<br/>
                                  Plate: {inc.user?.plate||'—'}<br/>
                                  Blood: {inc.user?.blood||'—'}
                                </div>
                              </div>
                              <div>
                                <div className={styles.expLabel}>GPS</div>
                                <div className={styles.expText}>
                                  Lat: {inc.gps?.lat||1.3521}°N<br/>
                                  Lng: {inc.gps?.lng||103.8198}°E<br/>
                                  Accuracy: ±5m
                                </div>
                              </div>
                              <div>
                                <div className={styles.expLabel}>Actions</div>
                                <div style={{display:'flex',flexDirection:'column',gap:6}}>
                                  <button className={styles.dlBtn} onClick={()=>showToast('📄 Report exported','success')}>📄 Export Report</button>
                                  <button className={styles.dlBtn} onClick={()=>showToast('⬇ Download started','success')}>⬇ Download Video</button>
                                </div>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )
                  ];
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
