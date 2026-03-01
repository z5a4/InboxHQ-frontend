import { useNavigate } from 'react-router-dom';
import Avatar from './Avatar.jsx';
import styles from './ProfileModal.module.css';

export default function ProfileModal({ user, onClose }) {
  const navigate = useNavigate();

  const handleViewFullProfile = () => {
    navigate(`/profile/${user._id}`);
    onClose();
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2>User Profile</h2>
          <button className={styles.closeBtn} onClick={onClose}>
            ✕
          </button>
        </div>

        <div className={styles.modalBody}>
          <div className={styles.avatarSection}>
            <Avatar user={user} size={80} showOnline={true} />
          </div>

          <div className={styles.infoSection}>
            <h3 className={styles.displayName}>
              {user.displayName || user.username}
            </h3>
            {user.displayName && (
              <p className={styles.username}>@{user.username}</p>
            )}
            {user.email && (
              <div className={styles.infoRow}>
                <span className={styles.label}>Email:</span>
                <span className={styles.value}>{user.email}</span>
              </div>
            )}
            {user.bio && (
              <div className={styles.infoRow}>
                <span className={styles.label}>Bio:</span>
                <span className={styles.value}>{user.bio}</span>
              </div>
            )}
            <div className={styles.infoRow}>
              <span className={styles.label}>Status:</span>
              <span className={`${styles.value} ${user.isOnline ? styles.online : styles.offline}`}>
                {user.isOnline ? '● Online' : '○ Offline'}
              </span>
            </div>
            {!user.isOnline && user.lastSeen && (
              <div className={styles.infoRow}>
                <span className={styles.label}>Last seen:</span>
                <span className={styles.value}>
                  {new Date(user.lastSeen).toLocaleString()}
                </span>
              </div>
            )}
          </div>

          <div className={styles.modalActions}>
            <button
              className={styles.fullProfileBtn}
              onClick={handleViewFullProfile}
            >
              View Full Profile
            </button>
            <button className={styles.closeBtnAlt} onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}