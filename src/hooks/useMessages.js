import { useState, useCallback } from 'react';
import api from '../utils/api.js';

export const useMessages = (convId) => {
  const [messages, setMessages]   = useState([]);
  const [loading, setLoading]     = useState(false);
  const [hasMore, setHasMore]     = useState(false);
  const [page, setPage]           = useState(1);

  const fetchMessages = useCallback(async (p = 1, append = false) => {
    setLoading(!append);
    try {
      const res = await api.get(
        `/chat/conversations/${convId}/messages?page=${p}&limit=30`
      );
      const { messages: msgs, pagination } = res.data;
      if (append) {
        setMessages((prev) => [...msgs, ...prev]);
      } else {
        setMessages(msgs);
      }
      setHasMore(pagination.page < pagination.pages);
      setPage(p);
    } catch (err) {
      console.error('Fetch messages error:', err);
    } finally {
      setLoading(false);
    }
  }, [convId]);

  const addMessage = (msg) => {
    setMessages((prev) => {
      if (prev.find((m) => m._id === msg._id)) return prev;
      return [...prev, msg];
    });
  };

  const updateReadBy = (userId) => {
    setMessages((prev) =>
      prev.map((m) => ({
        ...m,
        readBy: m.readBy?.includes(userId)
          ? m.readBy
          : [...(m.readBy || []), userId],
      }))
    );
  };

  const loadMore = async () => {
    await fetchMessages(page + 1, true);
  };

  return {
    messages,
    loading,
    hasMore,
    fetchMessages,
    addMessage,
    updateReadBy,
    loadMore,
  };
};