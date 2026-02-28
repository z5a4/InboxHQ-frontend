import { useState, useEffect, useRef, useCallback } from 'react';
import { getSocket } from '../utils/socket.js';
import api from '../utils/api.js';
import Avatar from './Avatar.jsx';
import { formatMessageTime, formatDateSeparator, formatLastSeen, isSameDay } from '../utils/format.js';
import styles from './ChatWindow.module.css';

export default function ChatWindow({ conversation, currentUser, onConvUpdate }) {
  const [messages, setMessages]   = useState([]);
  const [input, setInput]         = useState('');
  const [loading, setLoading]     = useState(true);
  const [hasMore, setHasMore]     = useState(false);
  const [page, setPage]           = useState(1);
  const [typing, setTyping]       = useState(null);
  const [sending, setSending]     = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const bottomRef      = useRef(null);
  const inputRef       = useRef(null);
  const typingTimer    = useRef(null);
  const messagesEndRef = useRef(null);

  const convId = conversation._id;
  const other  = conversation.participants?.find((p) => p._id !== currentUser._id);

  // Fetch messages
  const fetchMessages = useCallback(async (p = 1, append = false) => {
    try {
      const res = await api.get(`/chat/conversations/${convId}/messages?page=${p}&limit=30`);
      const { messages: msgs, pagination } = res.data;
      if (append) {
        setMessages((prev) => [...msgs, ...prev]);
      } else {
        setMessages(msgs);
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'auto' }), 60);
      }
      setHasMore(pagination.page < pagination.pages);
    } catch (err) {
      console.error('Fetch messages error:', err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [convId]);

  useEffect(() => {
    setLoading(true);
    setPage(1);
    setMessages([]);
    setInput('');
    fetchMessages(1, false);
    inputRef.current?.focus();

    // Mark as read via REST
    api.put(`/chat/conversations/${convId}/read`).catch(() => {});
  }, [convId, fetchMessages]);

  // Socket events
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    socket.emit('conversation:join', convId);

    const onNewMessage = (msg) => {
      if (msg.conversationId !== convId) return;
      setMessages((prev) => {
        if (prev.find((m) => m._id === msg._id)) return prev;
        return [...prev, msg];
      });
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 60);
      socket.emit('messages:read', { conversationId: convId });
    };

    const onTypingStart = ({ userId, username, conversationId }) => {
      if (conversationId !== convId || userId === currentUser._id) return;
      setTyping(username);
    };

    const onTypingStop = ({ conversationId }) => {
      if (conversationId !== convId) return;
      setTyping(null);
    };

    const onMessagesRead = ({ conversationId: cId, userId }) => {
      if (cId !== convId || userId === currentUser._id) return;
      setMessages((prev) =>
        prev.map((m) => ({
          ...m,
          readBy: m.readBy?.includes(userId) ? m.readBy : [...(m.readBy || []), userId],
        }))
      );
    };

    socket.on('message:new', onNewMessage);
    socket.on('typing:start', onTypingStart);
    socket.on('typing:stop', onTypingStop);
    socket.on('messages:read', onMessagesRead);

    return () => {
      socket.off('message:new', onNewMessage);
      socket.off('typing:start', onTypingStart);
      socket.off('typing:stop', onTypingStop);
      socket.off('messages:read', onMessagesRead);
    };
  }, [convId, currentUser._id]);

  const handleInputChange = (e) => {
    setInput(e.target.value);
    const socket = getSocket();
    if (!socket) return;
    socket.emit('typing:start', { conversationId: convId });
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      socket.emit('typing:stop', { conversationId: convId });
    }, 1500);
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim() || sending) return;
    const content = input.trim();
    setInput('');
    setSending(true);
    const socket = getSocket();
    socket?.emit('typing:stop', { conversationId: convId });
    clearTimeout(typingTimer.current);
    try {
      socket?.emit('message:send', { conversationId: convId, content });
    } catch (err) {
      console.error('Send error:', err);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) sendMessage(e);
  };

  const loadMore = async () => {
    setLoadingMore(true);
    const nextPage = page + 1;
    setPage(nextPage);
    await fetchMessages(nextPage, true);
  };

  const isRead = (msg) => {
    if (msg.sender?._id !== currentUser._id && msg.sender !== currentUser._id) return false;
    return msg.readBy?.some((id) => {
      const idStr = typeof id === 'object' ? id.toString() : id;
      return idStr !== currentUser._id && idStr !== currentUser._id?.toString();
    });
  };

  return (
    <div className={styles.window}>
      {/* Header */}
      <header className={styles.header}>
        <Avatar user={other} size={40} />
        <div className={styles.headerInfo}>
          <span className={styles.headerName}>{other?.username}</span>
          <span className={`${styles.headerStatus} ${other?.isOnline ? styles.online : ''}`}>
            {other?.isOnline
              ? '● Online'
              : `Last seen ${formatLastSeen(other?.lastSeen)}`}
          </span>
        </div>
      </header>

      {/* Messages */}
      <div className={styles.messages}>
        {hasMore && (
          <div className={styles.loadMoreWrap}>
            <button
              className={styles.loadMoreBtn}
              onClick={loadMore}
              disabled={loadingMore}
            >
              {loadingMore ? 'Loading…' : '↑ Load older messages'}
            </button>
          </div>
        )}

        {loading ? (
          <MessagesSkeleton />
        ) : messages.length === 0 ? (
          <div className={styles.noMessages}>
            <span>👋</span>
            <p>Say hello to <strong>{other?.username}</strong>!</p>
          </div>
        ) : (
          messages.map((msg, idx) => {
            const isMine   = msg.sender?._id === currentUser._id || msg.sender === currentUser._id;
            const showDate = idx === 0 || !isSameDay(messages[idx - 1].createdAt, msg.createdAt);
            const prevSame = idx > 0 && (messages[idx - 1].sender?._id === msg.sender?._id);
            const nextSame = idx < messages.length - 1 && (messages[idx + 1].sender?._id === msg.sender?._id);
            const isLastMine = isMine && (!nextSame || messages[idx + 1]?.sender?._id !== msg.sender?._id);

            return (
              <div key={msg._id} className={styles.msgGroup}>
                {showDate && (
                  <div className={styles.dateSep}>
                    <span>{formatDateSeparator(msg.createdAt)}</span>
                  </div>
                )}
                <div className={`${styles.msgRow} ${isMine ? styles.mine : styles.theirs}`}>
                  {!isMine && (
                    <div className={styles.msgAvatar}>
                      {!nextSame && <Avatar user={other} size={30} showOnline={false} />}
                    </div>
                  )}
                  <div className={styles.msgContent}>
                    <div className={`${styles.bubble} ${isMine ? styles.bubbleMine : styles.bubbleTheirs}`}>
                      {msg.content}
                    </div>
                    <div className={`${styles.meta} ${isMine ? styles.metaMine : ''}`}>
                      <span>{formatMessageTime(msg.createdAt)}</span>
                      {isMine && isLastMine && (
                        <span className={`${styles.readTick} ${isRead(msg) ? styles.read : ''}`}>
                          {isRead(msg) ? '✓✓' : '✓'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}

        {/* Typing indicator */}
        {typing && (
          <div className={`${styles.msgRow} ${styles.theirs}`} style={{ marginBottom: 8 }}>
            <div className={styles.msgAvatar}>
              <Avatar user={other} size={30} showOnline={false} />
            </div>
            <div className={styles.typingBubble}>
              <span className={styles.typingDot} style={{ animationDelay: '0ms' }} />
              <span className={styles.typingDot} style={{ animationDelay: '160ms' }} />
              <span className={styles.typingDot} style={{ animationDelay: '320ms' }} />
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className={styles.inputArea}>
        <input
          ref={inputRef}
          className={styles.input}
          placeholder={`Message ${other?.username}…`}
          value={input}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          maxLength={2000}
          autoComplete="off"
        />
        <button
          className={styles.sendBtn}
          onClick={sendMessage}
          disabled={!input.trim() || sending}
          title="Send message"
        >
          <SendIcon />
        </button>
      </div>
    </div>
  );
}

const MessagesSkeleton = () => (
  <div className={styles.skeleton}>
    {[1, 2, 3, 4, 5].map((i) => (
      <div
        key={i}
        className={styles.skeletonMsg}
        style={{ alignSelf: i % 2 === 0 ? 'flex-end' : 'flex-start', width: `${30 + (i * 7) % 30}%` }}
      />
    ))}
  </div>
);

const SendIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13" />
    <polygon points="22,2 15,22 11,13 2,9" />
  </svg>
);