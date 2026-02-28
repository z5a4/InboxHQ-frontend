import { useState, useEffect } from 'react';
import api from '../utils/api.js';
import Avatar from './Avatar.jsx';
import styles from './CreateGroupModal.module.css';

export default function CreateGroupModal({ onClose, onGroupCreated }) {
  const [users, setUsers] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [groupName, setGroupName] = useState('');
  const [adminsOnly, setAdminsOnly] = useState(false);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const res = await api.get('/users');
      setUsers(res.data.users || []);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const toggleUser = (userId) => {
    setSelectedUsers((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (selectedUsers.length === 0) return;

    setLoading(true);
    try {
      const res = await api.post('/chat/groups', {
        participantIds: selectedUsers,
        groupName: groupName.trim() || undefined,
        adminsOnlyMessage: adminsOnly,
      });
      onGroupCreated(res.data.conversation);
      onClose();
    } catch (error) {
      console.error('Error creating group:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = users.filter(
    (u) =>
      u.username.toLowerCase().includes(search.toLowerCase()) ||
      (u.displayName && u.displayName.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2>Create Group</h2>
          <button className={styles.closeBtn} onClick={onClose}>
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className={styles.formGroup}>
            <label>Group Name (optional)</label>
            <input
              type="text"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="e.g., Team Chat"
              className={styles.input}
            />
          </div>

          <div className={styles.formGroup}>
            <label>Select Members</label>
            <input
              type="text"
              placeholder="Search users..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={styles.searchInput}
            />
            <div className={styles.userList}>
              {filteredUsers.map((user) => (
                <div
                  key={user._id}
                  className={`${styles.userItem} ${
                    selectedUsers.includes(user._id) ? styles.selected : ''
                  }`}
                  onClick={() => toggleUser(user._id)}
                >
                  <Avatar user={user} size={36} />
                  <span className={styles.userName}>
                    {user.displayName || user.username}
                  </span>
                  {selectedUsers.includes(user._id) && (
                    <span className={styles.checkmark}>✓</span>
                  )}
                </div>
              ))}
              {filteredUsers.length === 0 && (
                <div className={styles.noUsers}>No users found</div>
              )}
            </div>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={adminsOnly}
                onChange={(e) => setAdminsOnly(e.target.checked)}
              />
              Only admins can send messages
            </label>
          </div>

          <div className={styles.modalActions}>
            <button
              type="button"
              className={styles.cancelBtn}
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={styles.createBtn}
              disabled={selectedUsers.length === 0 || loading}
            >
              {loading ? 'Creating...' : 'Create Group'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}