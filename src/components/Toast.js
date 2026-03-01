import { useApp } from '../context/AppContext';
import styles from './Toast.module.css';

export default function ToastContainer() {
  const { toasts } = useApp();
  return (
    <div className={styles.container}>
      {toasts.map(t => (
        <div key={t.id} className={`${styles.toast} ${styles[t.type]}`}>
          <span className={styles.icon}>
            {t.type === 'success' ? '✓' : t.type === 'error' ? '✕' : '⚠'}
          </span>
          {t.message}
        </div>
      ))}
    </div>
  );
}
