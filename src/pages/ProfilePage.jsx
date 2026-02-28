// src/pages/ProfilePage.jsx
import { useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useNavigate, useParams } from 'react-router-dom';
import { useEffect } from 'react';
import api from '../utils/api.js';
import Avatar from '../components/Avatar.jsx';
import { formatLastSeen } from '../utils/format.js';
import styles from './ProfilePage.module.css';

export default function ProfilePage() {
  const { user: currentUser, updateUser, logout } = useAuth();
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    displayName: '',
    bio: '',
    avatar: ''
  });

  const isOwnProfile = !id || id === currentUser?._id;

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    try {
      const targetId = id || currentUser?._id;
      if (!targetId) return;
      
      const res = await api.get(`/users/${targetId}`);
      setProfile(res.data);
      
      if (res.data.isOwnProfile) {
        setFormData({
          displayName: res.data.user.displayName || '',
          bio: res.data.user.bio || '',
          avatar: res.data.user.avatar || ''
        });
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  }, [id, currentUser?._id]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await api.put('/users/profile', formData);
      updateUser(res.data.user);
      setEditing(false);
      setProfile(prev => ({
        ...prev,
        user: res.data.user
      }));
    } catch (error) {
      console.error('Error updating profile:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.loader} />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className={styles.page}>
        <div className={styles.error}>User not found</div>
      </div>
    );
  }

  const { user, canViewFullProfile } = profile;

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <button className={styles.backBtn} onClick={() => navigate('/')}>
          ← Back to chats
        </button>

        <div className={styles.avatarWrap}>
          <Avatar user={user} size={100} showOnline={true} showRestricted={!canViewFullProfile && !isOwnProfile} />
          {isOwnProfile && (
            <button 
              className={styles.editAvatarBtn}
              onClick={() => setEditing(true)}
            >
              ✎
            </button>
          )}
        </div>

        {editing ? (
          <div className={styles.editForm}>
            <input
              type="text"
              placeholder="Display Name"
              value={formData.displayName}
              onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
              className={styles.editInput}
            />
            <textarea
              placeholder="Bio"
              value={formData.bio}
              onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
              className={styles.editTextarea}
              rows="3"
            />
            <input
              type="text"
              placeholder="Avatar URL"
              value={formData.avatar}
              onChange={(e) => setFormData({ ...formData, avatar: e.target.value })}
              className={styles.editInput}
            />
            <div className={styles.editActions}>
              <button 
                className={styles.saveBtn}
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
              <button 
                className={styles.cancelBtn}
                onClick={() => setEditing(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            <h1 className={styles.username}>
              {user.displayName || user.username}
            </h1>
            {user.displayName && user.displayName !== user.username && (
              <p className={styles.handle}>@{user.username}</p>
            )}
            
            {user.bio && <p className={styles.bio}>{user.bio}</p>}

            {!canViewFullProfile && !isOwnProfile && (
              <div className={styles.restrictedNotice}>
                <span>🔒</span>
                <p>Accept chat request to view full profile</p>
              </div>
            )}

            <div className={styles.infoGrid}>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Email</span>
                <span className={styles.infoValue}>
                  {canViewFullProfile || isOwnProfile ? user.email : '••••••@•••••'}
                </span>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Status</span>
                <span className={styles.infoValue} style={{ color: user.isOnline ? 'var(--green)' : 'var(--text-3)' }}>
                  {user.isOnline ? '● Online' : '○ Offline'}
                </span>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Last seen</span>
                <span className={styles.infoValue}>
                  {user.lastSeen ? formatLastSeen(user.lastSeen) : 'Just now'}
                </span>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Member since</span>
                <span className={styles.infoValue}>
                  {user.createdAt
                    ? new Date(user.createdAt).toLocaleDateString('en-US', { 
                        year: 'numeric', 
                        month: 'short' 
                      })
                    : '—'}
                </span>
              </div>
            </div>

            {isOwnProfile && (
              <>
                <button 
                  className={styles.editBtn}
                  onClick={() => setEditing(true)}
                >
                  Edit Profile
                </button>
                <button 
                  className={styles.logoutBtn} 
                  onClick={handleLogout}
                >
                  Sign out of InboxHQ
                </button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}