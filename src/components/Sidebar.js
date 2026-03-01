import { NavLink } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import styles from './Sidebar.module.css';

const NAV = [
  { to:'/dashboard', icon:'⬡', label:'Dashboard' },
  { to:'/dashcam',   icon:'◉', label:'Dashcam' },
  { to:'/history',   icon:'≡', label:'History' },
  { to:'/profile',   icon:'◷', label:'Profile' },
];

export default function Sidebar() {
  const { profile, doLogout, incidents } = useApp();
  const initial = profile.name?.charAt(0)?.toUpperCase() || '?';
  return (
    <nav className={styles.sidebar}>
      <div className={styles.brand}>
        <div className={styles.brandName}>CRASH<span>GUARD</span></div>
        <div className={styles.brandSub}>AI Emergency System</div>
      </div>
      <ul className={styles.nav}>
        {NAV.map(n=>(
          <li key={n.to}>
            <NavLink to={n.to} className={({isActive})=>`${styles.navItem} ${isActive?styles.active:''}`}>
              <span className={styles.navIcon}>{n.icon}</span>
              {n.label}
              {n.to==='/history' && incidents.length>0 && (
                <span className={styles.badge}>{incidents.length}</span>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
      <div className={styles.bottom}>
        <div className={styles.userPill}>
          <div className={styles.avatar}>{initial}</div>
          <div>
            <div className={styles.userName}>{profile.name?.split(' ')[0] || 'Driver'}</div>
            <div className={styles.userRole}>Driver</div>
          </div>
        </div>
        <button className={styles.logoutBtn} onClick={doLogout}>↩ Sign Out</button>
      </div>
    </nav>
  );
}
