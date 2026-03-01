import styles from './UI.module.css';

export function Btn({ children, variant = 'primary', onClick, type = 'button', disabled, style, loading }) {
  return (
    <button
      type={type}
      className={`${styles.btn} ${styles[`btn_${variant}`]}`}
      onClick={onClick}
      disabled={disabled || loading}
      style={style}
    >
      {loading && <span className={styles.spinner} />}
      {children}
    </button>
  );
}

export function Input({ label, id, type = 'text', value, onChange, placeholder, required }) {
  return (
    <div className={styles.formGroup}>
      {label && <label className={styles.label} htmlFor={id}>{label}</label>}
      <input
        id={id}
        type={type}
        className={styles.input}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
      />
    </div>
  );
}

export function Select({ label, id, value, onChange, options }) {
  return (
    <div className={styles.formGroup}>
      {label && <label className={styles.label} htmlFor={id}>{label}</label>}
      <select id={id} className={styles.input} value={value} onChange={onChange}>
        {options.map(o => (
          <option key={o.value || o} value={o.value || o}>{o.label || o}</option>
        ))}
      </select>
    </div>
  );
}

export function Card({ children, style, accent }) {
  return (
    <div className={styles.card} style={style}>
      {accent && <div className={styles.cardAccent} style={{ background: accent }} />}
      {children}
    </div>
  );
}

export function SectionLabel({ children }) {
  return <div className={styles.sectionLabel}>{children}</div>;
}

export function Badge({ severity }) {
  const map = {
    minor: { label: 'MINOR', color: 'var(--green)', bg: 'var(--green-dim)' },
    moderate: { label: 'MODERATE', color: 'var(--amber)', bg: 'var(--amber-dim)' },
    severe: { label: 'SEVERE', color: 'var(--red)', bg: 'var(--red-dim)' },
  };
  const s = map[severity] || map.minor;
  return (
    <span className={styles.badge} style={{ color: s.color, background: s.bg, border: `1px solid ${s.color}` }}>
      {s.label}
    </span>
  );
}

export function StatCard({ label, value, sub, accent }) {
  return (
    <div className={styles.statCard}>
      <div className={styles.statLabel}>{label}</div>
      <div className={styles.statValue} style={{ color: accent }}>{value}</div>
      {sub && <div className={styles.statSub}>{sub}</div>}
      <div className={styles.statLine} style={{ background: accent }} />
    </div>
  );
}
