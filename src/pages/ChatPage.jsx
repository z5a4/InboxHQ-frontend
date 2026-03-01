import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useSocket } from '../hooks/useSocket.js';
import { useMediaQuery } from '../hooks/useMediaQuery.js';          // <-- NEW
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
  const [users, setUsers] = useState([]);
  const [userMap, setUserMap] = useState({});

  // Responsive state
  const isMobile = useMediaQuery('(max-width: 768px)');
  const [mobileView, setMobileView] = useState('list'); // 'list' or 'chat'

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
            const isFromCurrentUser = msg.sender?._id === user?._id;
            const isActive = activeConv?._id === c._id;
            const shouldIncrement = !isFromCurrentUser && !isActive;
            return {
              ...c,
              lastMessage: msg,
              unreadCount: (c.unreadCount || 0) + (shouldIncrement ? 1 : 0),
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
      // On mobile, after opening a conversation, switch to chat view
      if (isMobile) setMobileView('chat');
    } catch (err) {
      console.error('Open conversation error:', err);
    }
  };

  const handleSelectConv = (conv) => {
    setActiveConv(conv);
    if (isMobile) setMobileView('chat');
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

  
  // In the parent component (e.g., App.jsx or Dashboard.jsx)
const refreshData = async () => {
  try {
    const [convsRes, usersRes] = await Promise.all([
      api.get('/chat/conversations'),
      api.get('/users'),
    ]);
    const convs = convsRes.data.conversations || [];
    setConversations(convs);
    setUsers(usersRes.data.users || []);
    // Extract pending group invites from conversations
    const invites = convs.filter(c => c.type === 'group' && c.isPending === true);
    setGroupInvites(invites);
  } catch (error) {
    console.error('Refresh failed:', error);
  }
};

// Pass refreshData down as a prop
<Sidebar
  conversations={conversations}
  // ... other props
  onRefresh={refreshData}
/>

  const handleRespondToGroupInvite = (conversationId, _status) => {
    setGroupInvites((prev) => prev.filter((inv) => inv._id !== conversationId));
    fetchConversations();
  };

  const handleCreateGroup = () => {
    setShowCreateGroup(true);
  };

  const handleBackToList = () => {
    setMobileView('list');
  };

  // Determine what to render on mobile
  const showSidebar = !isMobile || (isMobile && mobileView === 'list');
  const showChat = !isMobile || (isMobile && mobileView === 'chat');

  return (
    <div className={styles.layout}>
      {showSidebar && (
        <Sidebar
          conversations={conversations}
          activeConv={activeConv}
          onSelectConv={handleSelectConv}
          onOpenConversation={openConversation}
          currentUser={user}
          loading={loading}
          onRefresh={refreshData}
          groupInvites={groupInvites}
          onRespondToGroupInvite={handleRespondToGroupInvite}
          userMap={userMap}
          onCreateGroup={handleCreateGroup}
        />
      )}
      {showChat && (
        <main className={styles.main}>
          <ChatWindow
            key={activeConv?._id}
            conversation={activeConv}
            currentUser={user}
            onConvUpdate={handleConvUpdate}
            userMap={userMap}
            onBack={handleBackToList}          // <-- NEW: back button for mobile
            isMobile={isMobile}                 // <-- NEW: pass mobile flag
          />
        </main>
      )}
      {showCreateGroup && (
        <CreateGroupModal
          onClose={() => setShowCreateGroup(false)}
          onGroupCreated={(newConv) => {
            setConversations((prev) => [newConv, ...prev]);
            setActiveConv(newConv);
            if (isMobile) setMobileView('chat');
          }}
        />
      )}
    </div>
  );
}