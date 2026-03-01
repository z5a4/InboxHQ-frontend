import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import api from '../utils/api.js';
import Avatar from './Avatar.jsx';
import styles from './GroupMembersModal.module.css';

export default function GroupMembersModal({ group, onClose, onUpdate }) {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [search, setSearch] = useState('');
  const [availableUsers, setAvailableUsers] = useState([]);
  const [showAddMember, setShowAddMember] = useState(false);
  const { user: currentUser } = useAuth();

  const isAdmin = group.admins?.includes(currentUser?._id);

  useEffect(() => {
    fetchMembers();
    if (isAdmin) {
      fetchAvailableUsers();
    }
  }, [group._id]);

  const fetchMembers = async () => {
    try {
      const res = await api.get(`/chat/groups/${group._id}/members`);
      setMembers(res.data.members || []);
    } catch (error) {
      console.error('Error fetching members:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableUsers = async () => {
    try {
      const res = await api.get('/users');
      const allUsers = res.data.users || [];
      // Filter out users who are already members
      const memberIds = members.map(m => m.user._id);
      const available = allUsers.filter(u => !memberIds.includes(u._id));
      setAvailableUsers(available);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const handleInvite = async (userId) => {
    setInviting(true);
    try {
      await api.post(`/chat/groups/${group._id}/invite`, {
        userIds: [userId]
      });
      // Refresh members list
      fetchMembers();
      setShowAddMember(false);
      setSearch('');
    } catch (error) {
      console.error('Error inviting user:', error);
    } finally {
      setInviting(false);
    }
  };

  const handleRemoveMember = async (userId) => {
    if (!isAdmin) return;
    // Note: You'll need to implement this endpoint in the backend
    try {
      await api.delete(`/chat/groups/${group._id}/members/${userId}`);
      fetchMembers();
    } catch (error) {
      console.error('Error removing member:', error);
    }
  };

  const handleMakeAdmin = async (userId) => {
    if (!isAdmin) return;
    // Note: You'll need to implement this endpoint in the backend
    try {
      await api.put(`/chat/groups/${group._id}/admins/${userId}`, { action: 'add' });
      fetchMembers();
    } catch (error) {
      console.error('Error making admin:', error);
    }
  };

  const handleRemoveAdmin = async (userId) => {
    if (!isAdmin) return;
    try {
      await api.put(`/chat/groups/${group._id}/admins/${userId}`, { action: 'remove' });
      fetchMembers();
    } catch (error) {
      console.error('Error removing admin:', error);
    }
  };

  const filteredAvailableUsers = availableUsers.filter(u =>
    u.username.toLowerCase().includes(search.toLowerCase()) ||
    (u.displayName && u.displayName.toLowerCase().includes(search.toLowerCase())) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  const getMemberStatus = (member) => {
    if (member.status === 'pending') return 'Pending';
    if (member.isAdmin) return 'Admin';
    return 'Member';
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2>Group Members</h2>
          <button className={styles.closeBtn} onClick={onClose}>
            ✕
          </button>
        </div>

        <div className={styles.modalBody}>
          {loading ? (
            <div className={styles.loader} />
          ) : (
            <>
              {/* Members List */}
              <div className={styles.memberList}>
                {members.map((member) => (
                  <div key={member.user._id} className={styles.memberItem}>
                    <Avatar user={member.user} size={40} />
                    <div className={styles.memberInfo}>
                      <span className={styles.memberName}>
                        {member.user.displayName || member.user.username}
                      </span>
                      <span className={styles.memberStatus}>
                        {getMemberStatus(member)}
                      </span>
                    </div>
                    
                    {isAdmin && member.user._id !== currentUser?._id && (
                      <div className={styles.memberActions}>
                        {member.isAdmin ? (
                          <button
                            className={styles.actionBtn}
                            onClick={() => handleRemoveAdmin(member.user._id)}
                            title="Remove admin"
                          >
                            👑
                          </button>
                        ) : member.status === 'accepted' && (
                          <button
                            className={styles.actionBtn}
                            onClick={() => handleMakeAdmin(member.user._id)}
                            title="Make admin"
                          >
                            ⭐
                          </button>
                        )}
                        <button
                          className={`${styles.actionBtn} ${styles.removeBtn}`}
                          onClick={() => handleRemoveMember(member.user._id)}
                          title="Remove member"
                        >
                          ✕
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Add Member Section (for admins) */}
              {isAdmin && (
                <div className={styles.addMemberSection}>
                  {!showAddMember ? (
                    <button
                      className={styles.addMemberBtn}
                      onClick={() => setShowAddMember(true)}
                    >
                      + Add Member
                    </button>
                  ) : (
                    <div className={styles.addMemberForm}>
                      <input
                        type="text"
                        placeholder="Search users by name or email..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className={styles.searchInput}
                        autoFocus
                      />
                      
                      <div className={styles.availableUsersList}>
                        {filteredAvailableUsers.length === 0 ? (
                          <div className={styles.noUsers}>No users available</div>
                        ) : (
                          filteredAvailableUsers.map((user) => (
                            <div key={user._id} className={styles.availableUserItem}>
                              <Avatar user={user} size={32} />
                              <span className={styles.availableUserName}>
                                {user.displayName || user.username}
                              </span>
                              <span className={styles.availableUserEmail}>
                                {user.email}
                              </span>
                              <button
                                className={styles.inviteBtn}
                                onClick={() => handleInvite(user._id)}
                                disabled={inviting}
                              >
                                {inviting ? '...' : 'Invite'}
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                      
                      <button
                        className={styles.cancelAddBtn}
                        onClick={() => {
                          setShowAddMember(false);
                          setSearch('');
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}