import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api.js';
import Avatar from './Avatar.jsx';
import { formatConversationTime } from '../utils/format.js';
import styles from './Sidebar.module.css';

export default function Sidebar({
  conversations,
  activeConv,
  onSelectConv,
  onOpenConversation,
  currentUser,
  loading,
  onRefresh,
  groupInvites,
  onRespondToGroupInvite,
  userMap, // <-- new prop
}) {
  const [tab, setTab] = useState('chats');
  const [users, setUsers] = useState([]); // for people tab only
  const [search, setSearch] = useState('');
  const [usersLoading, setUsersLoading] = useState(false);
  const { logout } = useAuth();
  const navigate = useNavigate();

  // Fetch users only for the people tab (separate from userMap)
  useEffect(() => {
    if (tab !== 'people') return;
    fetchUsers();
  }, [tab]);

  const fetchUsers = async () => {
    setUsersLoading(true);
    try {
      const res = await api.get('/users');
      setUsers(res.data.users || []);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setUsersLoading(false);
    }
  };

  const getOther = (conv) => {
  if (conv.type === 'group') return null;
  return conv.otherParticipant || null;
};

  const getGroupDisplayName = (conv) => {
    if (conv.groupName) return conv.groupName;
    const otherParticipants = conv.participants?.filter((p) => p._id !== currentUser?._id) || [];
    const names = otherParticipants.map((p) => p.displayName || p.username).join(', ');
    return names || 'Group';
  };

  const filteredConvs = (conversations || []).filter((c) => {
    if (c.type === 'group') {
      const name = getGroupDisplayName(c).toLowerCase();
      return name.includes(search.toLowerCase());
    } else {
      const other = getOther(c);
      if (!other) return true; // include even if we can't identify, will show fallback
      const searchLower = search.toLowerCase();
      return (
        other.username?.toLowerCase().includes(searchLower) ||
        other.displayName?.toLowerCase().includes(searchLower)
      );
    }
  });

  const filteredUsers = (users || []).filter((u) => {
    if (!u) return false;
    const searchLower = search.toLowerCase();
    return (
      u.username?.toLowerCase().includes(searchLower) ||
      u.email?.toLowerCase().includes(searchLower) ||
      (u.displayName && u.displayName.toLowerCase().includes(searchLower))
    );
  });

  const pendingConvs = (conversations || []).filter(
    (c) => c.isPending && !c.requestedByMe && c.type === 'direct'
  );
  const regularConvs = filteredConvs.filter(
    (c) => !c.isPending || c.requestedByMe || c.type === 'group'
  );

  const handleUserClick = (userId) => {
    onOpenConversation(userId);
    setTab('chats');
  };

  const handleRefresh = () => {
    if (onRefresh) onRefresh();
    if (tab === 'people') fetchUsers(); // only refresh people list when on that tab
  };

  const handleAcceptGroupInvite = async (conversationId) => {
    try {
      await api.put(`/chat/groups/${conversationId}/respond`, { status: 'accepted' });
      onRespondToGroupInvite(conversationId, 'accepted');
    } catch (error) {
      console.error('Error accepting group invite:', error);
    }
  };

  const handleDeclineGroupInvite = async (conversationId) => {
    try {
      await api.put(`/chat/groups/${conversationId}/respond`, { status: 'declined' });
      onRespondToGroupInvite(conversationId, 'declined');
    } catch (error) {
      console.error('Error declining group invite:', error);
    }
  };

  return (
    <aside className={styles.sidebar}>
      <div className={styles.header}>
        <div className={styles.brandRow}>
          <div className={styles.brand}>
            <span className={styles.brandMark}>✦</span>
            <span className={styles.brandName}>InboxHQ</span>
          </div>
          <div className={styles.headerActions}>
            <button className={styles.refreshBtn} onClick={handleRefresh} title="Refresh">
              <RefreshIcon />
            </button>
            <button className={styles.logoutBtn} onClick={logout} title="Logout">
              <LogoutIcon />
            </button>
          </div>
        </div>

        <button className={styles.meRow} onClick={() => navigate('/profile')}>
          <Avatar user={{ ...currentUser, isOnline: true }} size={36} />
          <div className={styles.meInfo}>
            <span className={styles.meName}>
              {currentUser?.displayName || currentUser?.username}
            </span>
            <span className={styles.meStatus}>
              <span className={styles.onlineDot}></span>
              Online · View profile
            </span>
          </div>
        </button>

        <div className={styles.searchWrap}>
          <SearchIcon />
          <input
            className={styles.search}
            placeholder={tab === 'chats' ? 'Search conversations...' : 'Search people...'}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button className={styles.clearSearch} onClick={() => setSearch('')}>
              ✕
            </button>
          )}
        </div>

        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${tab === 'chats' ? styles.tabActive : ''}`}
            onClick={() => setTab('chats')}
          >
            <ChatIcon />
            Chats
            {regularConvs.length > 0 && (
              <span className={styles.tabCount}>{regularConvs.length}</span>
            )}
            {(pendingConvs.length > 0 || groupInvites?.length > 0) && (
              <span className={styles.pendingBadge}>
                {pendingConvs.length + (groupInvites?.length || 0)}
              </span>
            )}
          </button>
          <button
            className={`${styles.tab} ${tab === 'people' ? styles.tabActive : ''}`}
            onClick={() => setTab('people')}
          >
            <PeopleIcon />
            People
          </button>
        </div>
      </div>

      <div className={styles.list}>
        {tab === 'chats' && (
          <>
            {/* Group Invites Section */}
            {groupInvites && groupInvites.length > 0 && (
              <div className={styles.groupInviteSection}>
                <div className={styles.groupInviteHeader}>
                  <span>Group Invitations</span>
                  <span className={styles.groupInviteCount}>{groupInvites.length}</span>
                </div>
                {groupInvites.map((invite) => (
                  <div key={invite._id} className={styles.groupInviteItem}>
                    <div className={styles.groupInviteInfo}>
                      <span className={styles.groupInviteName}>
                        {invite.groupName || 'Group Chat'}
                      </span>
                      <span className={styles.groupInviteFrom}>
                        Invited by {invite.invitedBy?.displayName || invite.invitedBy?.username}
                      </span>
                    </div>
                    <div className={styles.groupInviteActions}>
                      <button
                        className={styles.acceptInviteBtn}
                        onClick={() => handleAcceptGroupInvite(invite._id)}
                      >
                        Accept
                      </button>
                      <button
                        className={styles.declineInviteBtn}
                        onClick={() => handleDeclineGroupInvite(invite._id)}
                      >
                        Decline
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Pending Requests Section (direct) */}
            {pendingConvs.length > 0 && (
              <div className={styles.pendingSection}>
                <div className={styles.pendingHeader}>
                  <span>Chat Requests</span>
                  <span className={styles.pendingCount}>{pendingConvs.length}</span>
                </div>
                {pendingConvs.map((conv) => {
                  const other = getOther(conv);
                  return (
                    <button
                      key={conv._id}
                      className={`${styles.item} ${styles.pendingItem}`}
                      onClick={() => onSelectConv(conv)}
                    >
                      <Avatar user={other} size={44} />
                      <div className={styles.itemBody}>
                        <div className={styles.itemTop}>
                          <span className={styles.itemName}>
                            {other?.displayName || other?.username}
                          </span>
                          <span className={styles.pendingTag}>Request</span>
                        </div>
                        <div className={styles.itemPreview}>
                          <span className={styles.pendingMessage}>
                            Wants to chat with you
                          </span>
                        </div>
                        <div className={styles.itemTime}>
                          {new Date(conv.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Regular Conversations (both direct and group) */}
            {loading ? (
              <SidebarSkeleton />
            ) : regularConvs.length === 0 ? (
              <div className={styles.empty}>
                <div className={styles.emptyIcon}>💬</div>
                <p className={styles.emptyText}>
                  {search ? 'No conversations found' : 'No conversations yet'}
                </p>
                {!search && (
                  <button className={styles.startChatBtn} onClick={() => setTab('people')}>
                    Find people to chat with
                  </button>
                )}
              </div>
            ) : (
              <div className={styles.conversationsList}>
                {regularConvs.map((conv) => {
                  const isGroup = conv.type === 'group';
                  const otherUser = getOther(conv);
                  const displayName = isGroup
                    ? getGroupDisplayName(conv)
                    : otherUser?.displayName || otherUser?.username || 'User';
                  const avatarUser = isGroup ? { username: displayName } : otherUser;
                  const isActive = activeConv?._id === conv._id;
                  const lastMsg = conv.lastMessage;
                  const unreadCount = conv.unreadCount || 0;

                  return (
                    <button
                      key={conv._id}
                      className={`${styles.item} ${isActive ? styles.itemActive : ''} ${
                        unreadCount > 0 ? styles.unread : ''
                      }`}
                      onClick={() => onSelectConv(conv)}
                    >
                      <Avatar user={avatarUser} size={44} />
                      {isGroup && <span className={styles.groupIcon}>👥</span>}
                      <div className={styles.itemBody}>
                        <div className={styles.itemTop}>
                          <span
                            className={`${styles.itemName} ${
                              unreadCount > 0 ? styles.unreadName : ''
                            }`}
                          >
                            {displayName}
                          </span>
                          {lastMsg && (
                            <span className={styles.itemTime}>
                              {formatConversationTime(lastMsg.createdAt)}
                            </span>
                          )}
                        </div>
                        <div
                          className={`${styles.itemPreview} ${
                            unreadCount > 0 ? styles.unreadPreview : ''
                          }`}
                        >
                          {conv.isPending && conv.requestedByMe ? (
                            <span className={styles.pendingYouSent}>
                              <span className={styles.pendingIcon}>⏳</span>
                              Request sent
                            </span>
                          ) : lastMsg ? (
                            <>
                              {lastMsg.sender?._id === currentUser?._id && (
                                <span className={styles.you}>You: </span>
                              )}
                              {lastMsg.isSystemMessage ? (
                                <span className={styles.systemMsg}>{lastMsg.content}</span>
                              ) : (
                                <span className={styles.messageContent}>
                                  {lastMsg.content.length > 30
                                    ? lastMsg.content.substring(0, 30) + '...'
                                    : lastMsg.content}
                                </span>
                              )}
                            </>
                          ) : (
                            <em className={styles.noMessages}>No messages yet</em>
                          )}
                        </div>
                      </div>
                      {unreadCount > 0 && (
                        <span className={styles.unreadBadge}>{unreadCount}</span>
                      )}
                      {!isGroup && otherUser?.isOnline && (
                        <span className={styles.onlineIndicator} />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}

        {tab === 'people' &&
          (usersLoading ? (
            <SidebarSkeleton />
          ) : filteredUsers.length === 0 ? (
            <div className={styles.empty}>
              <div className={styles.emptyIcon}>👥</div>
              <p className={styles.emptyText}>
                {search ? 'No users found' : 'No other users available'}
              </p>
            </div>
          ) : (
            <div className={styles.peopleList}>
              {filteredUsers.map((u) => (
                <button
                  key={u._id}
                  className={styles.item}
                  onClick={() => handleUserClick(u._id)}
                >
                  <Avatar user={u} size={44} />
                  <div className={styles.itemBody}>
                    <div className={styles.itemTop}>
                      <span className={styles.itemName}>
                        {u.displayName || u.username}
                      </span>
                      {u.isOnline && <span className={styles.onlineBadge}>Online</span>}
                    </div>
                    <div className={styles.itemPreview}>
                      <span className={styles.userEmail}>{u.email}</span>
                      {u.conversationStatus === 'pending' && (
                        <span className={styles.requestSent}>
                          <span className={styles.pendingIcon}>⏳</span>
                          Request sent
                        </span>
                      )}
                      {!u.conversationStatus && !u.isOnline && u.lastSeen && (
                        <span className={styles.lastSeen}>
                          Last seen {new Date(u.lastSeen).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ))}
      </div>
    </aside>
  );
}

// Icons (unchanged)
const SearchIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

const LogoutIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
);

const RefreshIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M23 4v6h-6" />
    <path d="M1 20v-6h6" />
    <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
  </svg>
);

const ChatIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
  </svg>
);

const PeopleIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

const SidebarSkeleton = () => (
  <div className={styles.skeleton}>
    {[1, 2, 3, 4].map((i) => (
      <div key={i} className={styles.skeletonItem}>
        <div className={styles.skeletonAvatar} />
        <div className={styles.skeletonLines}>
          <div className={styles.skeletonLine} style={{ width: '60%' }} />
          <div className={styles.skeletonLine} style={{ width: '80%' }} />
        </div>
      </div>
    ))}
  </div>
);