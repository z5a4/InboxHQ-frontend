import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api.js';
import Avatar from './Avatar.jsx';
import { formatConversationTime } from '../utils/format.js';
import styles from './Sidebar.module.css';

export default function Sidebar({
  conversations, activeConv, onSelectConv,
  onOpenConversation, currentUser, loading,
}) {
  const [tab, setTab]       = useState('chats');
  const [users, setUsers]   = useState([]);
  const [search, setSearch] = useState('');
  const [usersLoading, setUsersLoading] = useState(false);
  const { logout } = useAuth();
  const navigate   = useNavigate();

  useEffect(() => {
    if (tab !== 'people') return;
    setUsersLoading(true);
    api.get('/users')
      .then((res) => setUsers(res.data.users))
      .catch(console.error)
      .finally(() => setUsersLoading(false));
  }, [tab]);

  const getOther = (conv) =>
    conv.participants?.find((p) => p._id !== currentUser._id);

  const filteredConvs = conversations.filter((c) => {
    const other = getOther(c);
    return other?.username?.toLowerCase().includes(search.toLowerCase());
  });

  const filteredUsers = users.filter(
    (u) =>
      u.username.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <aside className={styles.sidebar}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.brandRow}>
          <div className={styles.brand}>
            <span className={styles.brandMark}>✦</span>
            <span className={styles.brandName}>InboxHQ</span>
          </div>
          <button className={styles.logoutBtn} onClick={logout} title="Logout">
            <LogoutIcon />
          </button>
        </div>

        {/* Current user — click to view profile */}
        <button className={styles.meRow} onClick={() => navigate('/profile')}>
          <Avatar user={{ ...currentUser, isOnline: true }} size={32} />
          <div className={styles.meInfo}>
            <span className={styles.meName}>{currentUser.username}</span>
            <span className={styles.meStatus}>● Online · View profile</span>
          </div>
        </button>

        {/* Search */}
        <div className={styles.searchWrap}>
          <SearchIcon />
          <input
            className={styles.search}
            placeholder="Search conversations…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button className={styles.clearSearch} onClick={() => setSearch('')}>✕</button>
          )}
        </div>

        {/* Tabs */}
        <div className={styles.tabs}>
          {['chats', 'people'].map((t) => (
            <button
              key={t}
              className={`${styles.tab} ${tab === t ? styles.tabActive : ''}`}
              onClick={() => setTab(t)}
            >
              {t === 'chats' ? 'Chats' : 'People'}
              {t === 'chats' && conversations.length > 0 && (
                <span className={styles.tabCount}>{conversations.length}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className={styles.list}>
        {tab === 'chats' && (
          loading ? (
            <SidebarSkeleton />
          ) : filteredConvs.length === 0 ? (
            <div className={styles.empty}>
              {search ? 'No results found' : 'No conversations yet.\nGo to People to start chatting.'}
            </div>
          ) : (
            filteredConvs.map((conv) => {
              const other   = getOther(conv);
              const isActive = activeConv?._id === conv._id;
              const lastMsg  = conv.lastMessage;
              return (
                <button
                  key={conv._id}
                  className={`${styles.item} ${isActive ? styles.itemActive : ''}`}
                  onClick={() => onSelectConv(conv)}
                >
                  <Avatar user={other} size={42} />
                  <div className={styles.itemBody}>
                    <div className={styles.itemTop}>
                      <span className={styles.itemName}>{other?.username}</span>
                      {lastMsg && (
                        <span className={styles.itemTime}>
                          {formatConversationTime(lastMsg.createdAt)}
                        </span>
                      )}
                    </div>
                    <div className={styles.itemPreview}>
                      {lastMsg ? (
                        <>
                          {lastMsg.sender?._id === currentUser._id && (
                            <span className={styles.you}>You: </span>
                          )}
                          {lastMsg.content}
                        </>
                      ) : (
                        <em>No messages yet</em>
                      )}
                    </div>
                  </div>
                </button>
              );
            })
          )
        )}

        {tab === 'people' && (
          usersLoading ? (
            <SidebarSkeleton />
          ) : filteredUsers.length === 0 ? (
            <div className={styles.empty}>
              {search ? 'No users found' : 'No other users yet'}
            </div>
          ) : (
            filteredUsers.map((u) => (
              <button
                key={u._id}
                className={styles.item}
                onClick={() => { onOpenConversation(u._id); setTab('chats'); }}
              >
                <Avatar user={u} size={42} />
                <div className={styles.itemBody}>
                  <div className={styles.itemTop}>
                    <span className={styles.itemName}>{u.username}</span>
                    {u.isOnline && (
                      <span className={styles.onlineBadge}>Online</span>
                    )}
                  </div>
                  <div className={styles.itemPreview}>{u.email}</div>
                </div>
              </button>
            ))
          )
        )}
      </div>
    </aside>
  );
}

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

const SearchIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
    <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

const LogoutIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
    <polyline points="16,17 21,12 16,7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
);