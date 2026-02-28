import { useAuth } from '../context/AuthContext.jsx';
import { useNavigate } from 'react-router-dom';
import Avatar from '../components/Avatar.jsx';
import { formatLastSeen } from '../utils/format.js';
import styles from './ProfilePage.module.css';

export default function ProfilePage() {
  const { user, logout } = useAuth();
  const navigate         = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <button className={styles.backBtn} onClick={() => navigate('/')}>
          ← Back to chats
        </button>

        <div className={styles.avatarWrap}>
          <Avatar user={user} size={80} showOnline={false} />
          <span className={styles.onlinePill}>● Online</span>
        </div>

        <h1 className={styles.username}>{user?.username}</h1>
        <p className={styles.email}>{user?.email}</p>

        <div className={styles.infoGrid}>
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>Member since</span>
            <span className={styles.infoValue}>
              {user?.createdAt
                ? new Date(user.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
                : '—'}
            </span>
          </div>
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>Last seen</span>
            <span className={styles.infoValue}>
              {user?.lastSeen ? formatLastSeen(user.lastSeen) : 'Just now'}
            </span>
          </div>
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>Status</span>
            <span className={styles.infoValue} style={{ color: 'var(--green)' }}>● Active</span>
          </div>
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>Account</span>
            <span className={styles.infoValue}>Inbox Infotech Member</span>
          </div>
        </div>

        <button className={styles.logoutBtn} onClick={handleLogout}>
          Sign out of InboxHQ
        </button>
      </div>
    </div>
  );
}