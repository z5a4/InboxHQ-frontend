import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useSocket } from '../hooks/useSocket.js';
import api from '../utils/api.js';
import Sidebar from '../components/Sidebar.jsx';
import ChatWindow from '../components/ChatWindow.jsx';
import styles from './ChatPage.module.css';

export default function ChatPage() {
  const { user }                          = useAuth();
  const [conversations, setConversations] = useState([]);
  const [activeConv, setActiveConv]       = useState(null);
  const [loading, setLoading]             = useState(true);

  const fetchConversations = useCallback(async () => {
    try {
      const res = await api.get('/chat/conversations');
      setConversations(res.data.conversations);
    } catch (err) {
      console.error('Fetch conversations error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchConversations(); }, [fetchConversations]);

  // Socket events for real-time updates
  useSocket({
    'user:online': ({ userId }) => {
      setConversations((prev) =>
        prev.map((c) => ({
          ...c,
          participants: c.participants.map((p) =>
            p._id === userId ? { ...p, isOnline: true } : p
          ),
        }))
      );
      // Also update active conversation so header status updates live
      setActiveConv((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          participants: prev.participants.map((p) =>
            p._id === userId ? { ...p, isOnline: true } : p
          ),
        };
      });
    },
    'user:offline': ({ userId, lastSeen }) => {
      setConversations((prev) =>
        prev.map((c) => ({
          ...c,
          participants: c.participants.map((p) =>
            p._id === userId ? { ...p, isOnline: false, lastSeen } : p
          ),
        }))
      );
      // Update active conversation participant status too
      setActiveConv((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          participants: prev.participants.map((p) =>
            p._id === userId ? { ...p, isOnline: false, lastSeen } : p
          ),
        };
      });
    },
    'conversation:updated': (conv) => {
      setConversations((prev) => {
        const exists = prev.find((c) => c._id === conv._id);
        if (exists) return [conv, ...prev.filter((c) => c._id !== conv._id)];
        return [conv, ...prev];
      });
    },
  });

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
      />
      <main className={styles.main}>
        {activeConv ? (
          <ChatWindow
            key={activeConv._id}
            conversation={activeConv}
            currentUser={user}
            onConvUpdate={(conv) => {
              setActiveConv(conv);
              setConversations((prev) =>
                prev.map((c) => (c._id === conv._id ? conv : c))
              );
            }}
          />
        ) : (
          <EmptyState />
        )}
      </main>
    </div>
  );
}

const EmptyState = () => (
  <div className={styles.empty}>
    <div className={styles.emptyIcon}>✦</div>
    <h2 className={styles.emptyTitle}>InboxHQ</h2>
    <p className={styles.emptyText}>
      Select a conversation from the sidebar<br />or find a colleague to message.
    </p>
  </div>
);