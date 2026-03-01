import { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import styles from './Profile.module.css';

function Field({ label, id, type='text', value, onChange, placeholder }) {
  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={id}>{label}</label>
      <input id={id} type={type} className={styles.input} value={value||''} onChange={onChange} placeholder={placeholder}/>
    </div>
  );
}

export default function Profile() {
  const { profile, updateProfile, showToast, FIREBASE_CONFIGURED } = useApp();
  const [form, setForm] = useState({...profile});
  const [saving, setSaving] = useState(false);

  useEffect(() => { setForm({...profile}); }, [profile]);
  const set = k => e => setForm(p=>({...p,[k]:e.target.value}));

  const save = async () => {
    setSaving(true);
    try {
      await updateProfile(form);
      showToast(`✓ Profile saved to ${FIREBASE_CONFIGURED?'Firestore':'LocalStorage'}`, 'success');
    } catch(err) {
      showToast('Save failed: '+err.message, 'error');
    }
    setSaving(false);
  };

  const initial = form.name?.charAt(0)?.toUpperCase() || '?';

  return (
    <div>
      <div className={styles.pageHeader}>
        <div className={styles.pageTitle}>PROFILE</div>
        <div className={styles.pageSub}>Driver Details &amp; Emergency Contacts</div>
      </div>

      <div className={styles.profileCard}>
        <div className={styles.profileHeader}>
          <div className={styles.avatar}>{initial}</div>
          <div>
            <div className={styles.profileName}>{form.name||'Driver'}</div>
            <div className={styles.profileRole}>Registered Driver — CrashGuard AI</div>
          </div>
          <div className={styles.headerTags}>
            <span className={styles.tag} style={{color:'var(--red)',borderColor:'var(--red)'}}>Blood: {form.blood||'—'}</span>
            <span className={styles.tag}>Plate: {form.plate||'Not set'}</span>
            <span className={`${styles.tag} ${FIREBASE_CONFIGURED?styles.tagGreen:styles.tagAmber}`}>
              {FIREBASE_CONFIGURED?'● Firestore':'● LocalStorage'}
            </span>
          </div>
        </div>
      </div>

      <div className={styles.grid}>
        <div>
          <div className={styles.sectionLabel}>Personal Information</div>
          <div className={styles.card}>
            <div className={styles.formGrid}>
              <Field label="Full Name" id="pn" value={form.name} onChange={set('name')} />
              <Field label="Email" id="pe" type="email" value={form.email} onChange={set('email')} />
              <Field label="Phone" id="pp" type="tel" value={form.phone} onChange={set('phone')} placeholder="+65 9123 4567" />
              <div className={styles.field}>
                <label className={styles.label}>Blood Type</label>
                <select className={styles.input} value={form.blood||'O+'} onChange={set('blood')}>
                  {['A+','A-','B+','B-','O+','O-','AB+','AB-'].map(b=><option key={b}>{b}</option>)}
                </select>
              </div>
            </div>
          </div>

          <div className={styles.sectionLabel} style={{marginTop:20}}>Emergency Contact</div>
          <div className={styles.card}>
            <div className={styles.formGrid}>
              <Field label="Contact Name" id="ecn" value={form.emergencyName} onChange={set('emergencyName')} placeholder="Parent / Guardian" />
              <Field label="Contact Email" id="ece" type="email" value={form.emergencyEmail} onChange={set('emergencyEmail')} placeholder="family@example.com" />
            </div>
            <div className={styles.emailPreview}>
              <div className={styles.previewLabel}>Email sent on crash detection:</div>
              <div className={styles.previewBody}>
                <strong>To:</strong> {form.emergencyEmail||'[emergency email]'}<br/>
                <strong>Subject:</strong> 🚨 CrashGuard Alert — {form.name||'[driver]'} has been in a crash<br/><br/>
                Dear {form.emergencyName||'Emergency Contact'},<br/>
                A crash has been detected. Please contact emergency services.<br/><br/>
                <span style={{color:'var(--muted)'}}>
                  Vehicle: {form.plate||'[plate]'} — {form.vehicle||'[vehicle]'}<br/>
                  Blood Type: {form.blood||'Unknown'} | GPS: 1.3521°N, 103.8198°E
                </span>
              </div>
            </div>
          </div>
        </div>

        <div>
          <div className={styles.sectionLabel}>Vehicle Details</div>
          <div className={styles.card} style={{marginBottom:16}}>
            <div className={styles.formGrid}>
              <Field label="License Plate" id="vpl" value={form.plate} onChange={set('plate')} placeholder="SKZ 1234 A" />
              <Field label="Make / Model" id="vm" value={form.vehicle} onChange={set('vehicle')} placeholder="Toyota Corolla 2023" />
              <Field label="Color" id="vc" value={form.vehicleColor} onChange={set('vehicleColor')} placeholder="Pearl White" />
            </div>
          </div>

          <div className={styles.sectionLabel}>Privacy &amp; Security</div>
          <div className={styles.card}>
            {[
              '✓ No continuous tracking',
              '✓ No background surveillance',
              '✓ No biometric/identity recognition',
              '✓ Encryption in transit (TLS 1.3)',
              '✓ Images transmitted only on severe events',
              '✓ On-device AI — no video leaves phone',
            ].map(p=>(
              <div key={p} className={styles.privItem}>
                <span style={{color:'var(--green)',fontFamily:'var(--font-mono)',fontSize:'0.7rem'}}>{p}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className={styles.actions}>
        <button className={styles.btnPrimary} onClick={save} disabled={saving}>
          {saving ? <span className={styles.spinner}/> : null} Save to {FIREBASE_CONFIGURED?'Firestore':'LocalStorage'}
        </button>
        <button className={styles.btnOutline} onClick={()=>setForm({...profile})}>Discard Changes</button>
      </div>
    </div>
  );
}
