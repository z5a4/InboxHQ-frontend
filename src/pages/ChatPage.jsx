import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useSocket } from '../hooks/useSocket.js';
import api from '../utils/api.js';
import Sidebar from '../components/Sidebar.jsx';
import ChatWindow from '../components/ChatWindow.jsx';
import CreateGroupModal from '../components/CreateGroupModal.jsx';
import styles from './ChatPage.module.css';

export default function ChatPage() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [activeConv, setActiveConv] = useState(null);
  const [loading, setLoading] = useState(true);
  const [groupInvites, setGroupInvites] = useState([]);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  // New state for users and userMap
  const [users, setUsers] = useState([]);
  const [userMap, setUserMap] = useState({});

  // Fetch users once on mount
  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const res = await api.get('/users');
      const usersData = res.data.users || [];
      setUsers(usersData);
      const map = {};
      usersData.forEach(u => map[u._id] = u);
      setUserMap(map);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const fetchConversations = useCallback(async () => {
    try {
      const res = await api.get('/chat/conversations');
      setConversations(res.data.conversations || []);
      const invites = (res.data.conversations || []).filter(
        (c) => c.type === 'group' && c.isPending === true
      );
      setGroupInvites(invites);
    } catch (err) {
      console.error('Fetch conversations error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  useSocket({
    'user:online': ({ userId }) => {
      updateUserOnlineStatus(userId, true);
    },
    'user:offline': ({ userId, lastSeen }) => {
      updateUserOnlineStatus(userId, false, lastSeen);
    },
    'conversation:updated': (conv) => {
      setConversations((prev) => {
        const exists = prev.find((c) => c._id === conv._id);
        if (exists) {
          return [conv, ...prev.filter((c) => c._id !== conv._id)];
        }
        return [conv, ...prev];
      });
      if (conv.type === 'group' && conv.isPending) {
        setGroupInvites((prev) => {
          if (!prev.find((c) => c._id === conv._id)) {
            return [...prev, conv];
          }
          return prev;
        });
      } else {
        setGroupInvites((prev) => prev.filter((c) => c._id !== conv._id));
      }
    },
    'message:new': (msg) => {
      setConversations((prev) =>
        prev.map((c) => {
          if (c._id === msg.conversationId) {
            const isActive = activeConv?._id === c._id;
            return {
              ...c,
              lastMessage: msg,
              unreadCount: isActive ? c.unreadCount : (c.unreadCount || 0) + 1,
            };
          }
          return c;
        })
      );
    },
    'group:invite': () => fetchConversations(),
    'group:invite:response': () => fetchConversations(),
    'chat:request:accepted': ({ conversationId, conversation }) => {
      setConversations(prev => {
        const exists = prev.find(c => c._id === conversationId);
        if (exists) {
          return prev.map(c =>
            c._id === conversationId ? { ...conversation, isPending: false } : c
          );
        } else {
          return [conversation, ...prev];
        }
      });
      setActiveConv(prev =>
        prev?._id === conversationId ? { ...conversation, isPending: false } : prev
      );
    },
  });

  const updateUserOnlineStatus = (userId, isOnline, lastSeen = null) => {
    setConversations((prev) =>
      prev.map((c) => ({
        ...c,
        participants: c.participants?.map((p) =>
          p._id === userId ? { ...p, isOnline, lastSeen: lastSeen || p.lastSeen } : p
        ),
        otherParticipant:
          c.otherParticipant?._id === userId
            ? { ...c.otherParticipant, isOnline, lastSeen: lastSeen || c.otherParticipant.lastSeen }
            : c.otherParticipant,
      }))
    );
    setActiveConv((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        participants: prev.participants?.map((p) =>
          p._id === userId ? { ...p, isOnline, lastSeen: lastSeen || p.lastSeen } : p
        ),
        otherParticipant:
          prev.otherParticipant?._id === userId
            ? { ...prev.otherParticipant, isOnline, lastSeen: lastSeen || prev.otherParticipant.lastSeen }
            : prev.otherParticipant,
      };
    });
  };

  const openConversation = async (userId) => {
    try {
      const res = await api.get(`/chat/conversations/${userId}/user`);
      const conv = res.data.conversation;
      setActiveConv(conv);
      setConversations((prev) => {
        const exists = prev.find((c) => c._id === conv._id);
        if (!exists) return [conv, ...prev];
        return prev;
      });
    } catch (err) {
      console.error('Open conversation error:', err);
    }
  };

  const handleSelectConv = (conv) => {
    setActiveConv(conv);
    if (conv._id && conv.unreadCount > 0) {
      api.put(`/chat/conversations/${conv._id}/read`).catch(() => {});
      setConversations((prev) =>
        prev.map((c) => (c._id === conv._id ? { ...c, unreadCount: 0 } : c))
      );
    }
  };

  const handleConvUpdate = (updatedConv) => {
    setActiveConv(updatedConv);
    setConversations((prev) =>
      prev.map((c) => (c._id === updatedConv._id ? updatedConv : c))
    );
  };

  const handleRefresh = () => {
    fetchConversations();
    fetchUsers(); // refresh user list as well
  };

  // eslint-disable-next-line no-unused-vars
  const handleRespondToGroupInvite = (conversationId, _status) => {
    setGroupInvites((prev) => prev.filter((inv) => inv._id !== conversationId));
    fetchConversations();
  };

  const handleCreateGroup = () => {
    setShowCreateGroup(true);
  };

  return (
    <div className={styles.layout}>
      <Sidebar
        conversations={conversations}
        activeConv={activeConv}
        onSelectConv={handleSelectConv}
        onOpenConversation={openConversation}
        currentUser={user}
        loading={loading}
        onRefresh={handleRefresh}
        groupInvites={groupInvites}
        onRespondToGroupInvite={handleRespondToGroupInvite}
        userMap={userMap}            // <-- pass userMap
      />
      <main className={styles.main}>
        <ChatWindow
          key={activeConv?._id}
          conversation={activeConv}
          currentUser={user}
          onConvUpdate={handleConvUpdate}
          userMap={userMap}            // <-- pass userMap
        />
      </main>
      {showCreateGroup && (
        <CreateGroupModal
          onClose={() => setShowCreateGroup(false)}
          onGroupCreated={(newConv) => {
            setConversations((prev) => [newConv, ...prev]);
            setActiveConv(newConv);
          }}
        />
      )}
      <button className={styles.createGroupFab} onClick={handleCreateGroup} title="Create Group">
        +
      </button>
    </div>
  );
}