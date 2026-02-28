import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { getSocket } from '../utils/socket.js';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api.js';
import Avatar from './Avatar.jsx';
import {
  formatMessageTime,
  formatDateSeparator,
  formatLastSeen,
  isSameDay,
} from '../utils/format.js';
import styles from './ChatWindow.module.css';

export default function ChatWindow({ conversation, currentUser, onConvUpdate, userMap }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(1);
  const [typing, setTyping] = useState(null);
  const [sending, setSending] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [accepting, setAccepting] = useState(false);

  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const typingTimer = useRef(null);
  const messagesEndRef = useRef(null);
  const navigate = useNavigate();

  const convId = conversation?._id;
  const isGroup = conversation?.type === 'group';
  
  // Derive other user from multiple sources
  const otherFromConversation = !isGroup
    ? conversation?.otherParticipant ||
      conversation?.participants?.find((p) => p._id !== currentUser?._id)
    : null;

  const effectiveOther = useMemo(() => {
  if (isGroup) return null;
  if (conversation?.otherParticipant) {
    return conversation.otherParticipant;
  }
  // Fallback (rare)
  const otherSender = messages.find(m => m.sender?._id !== currentUser?._id)?.sender;
  return otherSender || null;
}, [isGroup, conversation, messages, currentUser]);

  const groupDisplayName = isGroup
    ? conversation?.groupName ||
      conversation?.participants
        ?.filter((p) => p._id !== currentUser?._id)
        .map((p) => p.displayName || p.username)
        .join(', ') || 'Group'
    : '';

  const isPending = conversation?.isPending;
  const requestedByMe = conversation?.requestedByMe;

  const fetchMessages = useCallback(
    async (p = 1, append = false) => {
      if (!convId || isPending) {
        setLoading(false);
        return;
      }

      try {
        const res = await api.get(`/chat/conversations/${convId}/messages?page=${p}&limit=30`);
        const { messages: msgs, pagination } = res.data;
        if (append) {
          setMessages((prev) => [...msgs, ...prev]);
        } else {
          setMessages(msgs || []);
          setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
          }, 60);
        }
        setHasMore(pagination?.page < pagination?.pages);
      } catch (err) {
        console.error('Fetch messages error:', err);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [convId, isPending]
  );

  useEffect(() => {
    if (!convId) return;

    setLoading(true);
    setPage(1);
    setMessages([]);
    setInput('');
    fetchMessages(1, false);
    inputRef.current?.focus();

    if (!isPending && convId) {
      api.put(`/chat/conversations/${convId}/read`).catch(() => {});
    }
  }, [convId, fetchMessages, isPending]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket || !convId) return;

    socket.emit('conversation:join', convId);

    const onNewMessage = (msg) => {
      if (msg.conversationId !== convId) return;
      setMessages((prev) => {
        if (prev.find((m) => m._id === msg._id)) return prev;
        return [...prev, msg];
      });
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 60);
      if (!isPending) {
        socket.emit('messages:read', { conversationId: convId });
      }
      if (msg.sender._id !== currentUser?._id) {
        socket.emit('message:delivered', {
          messageId: msg._id,
          conversationId: convId,
        });
      }
    };

    const onTypingStart = ({ userId, username, conversationId }) => {
      if (conversationId !== convId || userId === currentUser?._id) return;
      setTyping(username);
    };

    const onTypingStop = ({ conversationId }) => {
      if (conversationId !== convId) return;
      setTyping(null);
    };

    const onMessagesRead = ({ conversationId: cId, userId }) => {
      if (cId !== convId || userId === currentUser?._id) return;
      setMessages((prev) =>
        prev.map((m) => ({
          ...m,
          readBy: m.readBy?.includes(userId) ? m.readBy : [...(m.readBy || []), userId],
        }))
      );
    };

    const onDeliveryUpdated = ({ messageId, deliveredTo }) => {
      setMessages((prev) =>
        prev.map((m) => (m._id === messageId ? { ...m, deliveredTo } : m))
      );
    };

    socket.on('message:new', onNewMessage);
    socket.on('typing:start', onTypingStart);
    socket.on('typing:stop', onTypingStop);
    socket.on('messages:read', onMessagesRead);
    socket.on('message:delivery:updated', onDeliveryUpdated);

    return () => {
      socket.off('message:new', onNewMessage);
      socket.off('typing:start', onTypingStart);
      socket.off('typing:stop', onTypingStop);
      socket.off('messages:read', onMessagesRead);
      socket.off('message:delivery:updated', onDeliveryUpdated);
    };
  }, [convId, currentUser?._id, isPending]);

  const handleInputChange = (e) => {
    setInput(e.target.value);
    if (isPending || !convId) return;

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
    if (!input.trim() || sending || isPending || !convId) return;

    const content = input.trim();
    setInput('');
    setSending(true);

    const socket = getSocket();
    socket?.emit('typing:stop', { conversationId: convId });
    clearTimeout(typingTimer.current);

    try {
      socket?.emit('message:send', {
        conversationId: convId,
        content,
      });
    } catch (err) {
      console.error('Send error:', err);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const handleAcceptRequest = async () => {
    if (!convId) return;
    setAccepting(true);
    try {
      await api.put(`/chat/conversations/${convId}/respond`, { status: 'accepted' });
      if (onConvUpdate) {
        const updatedConv = { ...conversation, isPending: false, status: 'accepted' };
        onConvUpdate(updatedConv);
      }
      fetchMessages(1, false);
    } catch (error) {
      console.error('Error accepting request:', error);
    } finally {
      setAccepting(false);
    }
  };

  const handleDeclineRequest = async () => {
    if (!convId) return;
    setAccepting(true);
    try {
      await api.put(`/chat/conversations/${convId}/respond`, { status: 'declined' });
      navigate('/');
    } catch (error) {
      console.error('Error declining request:', error);
    } finally {
      setAccepting(false);
    }
  };

  const handleViewProfile = () => {
    if (effectiveOther?._id) {
      navigate(`/profile/${effectiveOther._id}`);
    }
  };

  const handleViewGroupMembers = () => {
    alert('Group members modal - implement as needed');
  };

  const getMessageStatus = (msg) => {
    if (!msg || msg.sender?._id !== currentUser?._id) return null;
    if (msg.readBy?.some((id) => id.toString() !== currentUser._id)) {
      return { icon: '✓✓', title: 'Read', className: styles.read };
    }
    if (msg.deliveredTo?.some((id) => id.toString() !== currentUser._id)) {
      return { icon: '✓✓', title: 'Delivered', className: styles.delivered };
    }
    return { icon: '✓', title: 'Sent', className: styles.sent };
  };

  if (!conversation || !convId) {
    return (
      <div className={styles.window}>
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>💬</div>
          <h3>No conversation selected</h3>
          <p>Choose a chat from the sidebar to start messaging</p>
        </div>
      </div>
    );
  }

  if (isPending && !isGroup) {
    return (
      <div className={styles.window}>
        <header className={styles.header}>
          <div className={styles.headerLeft}>
            <Avatar user={effectiveOther} size={44} />
            <div className={styles.headerInfo}>
              <span className={styles.headerName}>
                {effectiveOther?.displayName || effectiveOther?.username || 'User'}
              </span>
              <span className={styles.headerStatus}>
                <span
                  className={`${styles.statusDot} ${effectiveOther?.isOnline ? styles.online : ''}`}
                />
                {effectiveOther?.isOnline ? 'Online' : `Last seen ${formatLastSeen(effectiveOther?.lastSeen)}`}
              </span>
            </div>
          </div>
          <button className={styles.profileBtn} onClick={handleViewProfile}>
            View Profile
          </button>
        </header>

        <div className={styles.pendingContainer}>
          <div className={styles.pendingCard}>
            <div className={styles.pendingIcon}>{requestedByMe ? '⏳' : '📨'}</div>
            <h3 className={styles.pendingTitle}>
              {requestedByMe ? 'Request Sent' : 'Chat Request'}
            </h3>
            <p className={styles.pendingDescription}>
              {requestedByMe
                ? `You've sent a chat request to ${effectiveOther?.displayName || effectiveOther?.username}. They'll be notified and can accept your request to start chatting.`
                : `${effectiveOther?.displayName || effectiveOther?.username} wants to start a conversation with you. Accept the request to begin messaging.`}
            </p>
            {!requestedByMe && (
              <div className={styles.pendingActions}>
                <button
                  className={`${styles.actionButton} ${styles.acceptButton}`}
                  onClick={handleAcceptRequest}
                  disabled={accepting}
                >
                  {accepting ? (
                    <>
                      <span className={styles.buttonSpinner} />
                      Processing...
                    </>
                  ) : (
                    'Accept Request'
                  )}
                </button>
                <button
                  className={`${styles.actionButton} ${styles.declineButton}`}
                  onClick={handleDeclineRequest}
                  disabled={accepting}
                >
                  Decline
                </button>
              </div>
            )}
            {requestedByMe && (
              <div className={styles.pendingStatus}>
                <div className={styles.pendingSpinner} />
                <span>Waiting for response...</span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.window}>
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <Avatar
            user={isGroup ? { username: groupDisplayName } : effectiveOther}
            size={44}
          />
          <div className={styles.headerInfo}>
            <span className={styles.headerName}>
              {isGroup ? groupDisplayName : effectiveOther?.displayName || effectiveOther?.username || 'User'}
            </span>
            {isGroup ? (
              <span className={styles.headerStatus}>
                <span className={styles.groupMemberCount}>
                  {conversation.participants?.length || 0} members
                </span>
              </span>
            ) : (
              <span className={styles.headerStatus}>
                <span
                  className={`${styles.statusDot} ${effectiveOther?.isOnline ? styles.online : ''}`}
                />
                {effectiveOther?.isOnline ? 'Online' : `Last seen ${formatLastSeen(effectiveOther?.lastSeen)}`}
              </span>
            )}
          </div>
        </div>
        {isGroup ? (
          <button className={styles.profileBtn} onClick={handleViewGroupMembers}>
            <GroupIcon />
            <span>Members</span>
          </button>
        ) : (
          <button className={styles.profileBtn} onClick={handleViewProfile}>
            <UserIcon />
            <span>Profile</span>
          </button>
        )}
      </header>

      <div className={styles.messagesContainer} ref={bottomRef}>
        {hasMore && (
          <div className={styles.loadMore}>
            <button
              className={styles.loadMoreButton}
              onClick={() => {
                setLoadingMore(true);
                const nextPage = page + 1;
                setPage(nextPage);
                fetchMessages(nextPage, true);
              }}
              disabled={loadingMore}
            >
              {loadingMore ? (
                <>
                  <span className={styles.buttonSpinner} />
                  Loading...
                </>
              ) : (
                'Load older messages'
              )}
            </button>
          </div>
        )}

        <div className={styles.messages}>
          {loading ? (
            <MessagesSkeleton />
          ) : messages.length === 0 ? (
            <div className={styles.welcomeMessage}>
              <div className={styles.welcomeAvatar}>
                <Avatar user={isGroup ? { username: groupDisplayName } : effectiveOther} size={64} />
              </div>
              <h4>{isGroup ? groupDisplayName : effectiveOther?.displayName || effectiveOther?.username}</h4>
              <p>This is the beginning of your conversation</p>
              <span className={styles.welcomeHint}>Say hello! 👋</span>
            </div>
          ) : (
            messages.map((msg, idx) => {
              const isMine = msg.sender?._id === currentUser?._id;
              const showDate =
                idx === 0 || !isSameDay(messages[idx - 1]?.createdAt, msg.createdAt);
              const isFirstInGroup =
                idx === 0 || messages[idx - 1]?.sender?._id !== msg.sender?._id;
              const isLastInGroup =
                idx === messages.length - 1 ||
                messages[idx + 1]?.sender?._id !== msg.sender?._id;
              const status = getMessageStatus(msg);

              if (msg.isSystemMessage) {
                return (
                  <div key={msg._id} className={styles.systemMessage}>
                    <span>{msg.content}</span>
                  </div>
                );
              }

              return (
                <div key={msg._id} className={styles.messageWrapper}>
                  {showDate && (
                    <div className={styles.dateDivider}>
                      <span>{formatDateSeparator(msg.createdAt)}</span>
                    </div>
                  )}
                  <div
                    className={`${styles.messageRow} ${isMine ? styles.mine : styles.theirs}`}
                  >
                    {!isMine && isFirstInGroup && (
                      <div className={styles.messageAvatar}>
                        <Avatar user={msg.sender} size={32} showOnline={false} />
                      </div>
                    )}
                    <div className={styles.messageContent}>
                      <div
                        className={`${styles.bubble} ${
                          isMine ? styles.myBubble : styles.theirBubble
                        }`}
                      >
                        {msg.content}
                      </div>
                      <div
                        className={`${styles.messageMeta} ${isMine ? styles.myMeta : ''}`}
                      >
                        <span className={styles.messageTime}>
                          {formatMessageTime(msg.createdAt)}
                        </span>
                        {isMine && isLastInGroup && status && (
                          <span
                            className={`${styles.readReceipt} ${status.className}`}
                            title={status.title}
                          >
                            {status.icon}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}

          {typing && (
            <div className={`${styles.messageRow} ${styles.theirs}`}>
              <div className={styles.messageAvatar}>
                <Avatar user={effectiveOther} size={32} showOnline={false} />
              </div>
              <div className={styles.typingIndicator}>
                <span className={styles.typingDot} />
                <span className={styles.typingDot} />
                <span className={styles.typingDot} />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      <div className={styles.inputContainer}>
        <form className={styles.inputForm} onSubmit={sendMessage}>
          <input
            ref={inputRef}
            type="text"
            className={styles.messageInput}
            placeholder={
              isGroup
                ? `Message ${groupDisplayName}...`
                : `Message ${effectiveOther?.displayName || effectiveOther?.username}...`
            }
            value={input}
            onChange={handleInputChange}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage(e)}
            maxLength={2000}
            autoComplete="off"
            disabled={isPending}
          />
          <button
            type="submit"
            className={styles.sendButton}
            disabled={!input.trim() || sending || isPending}
          >
            {sending ? <span className={styles.sendSpinner} /> : <SendIcon />}
          </button>
        </form>
      </div>
    </div>
  );
}

// Icons and skeleton unchanged
const SendIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="22" y1="2" x2="11" y2="13" />
    <polygon points="22 2 15 22 11 13 2 9" />
  </svg>
);

const UserIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

const GroupIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 00-3-3.87" />
    <path d="M16 3.13a4 4 0 010 7.75" />
  </svg>
);

const MessagesSkeleton = () => {
  const widths = ['20%', '35%', '25%', '40%', '30%'];
  return (
    <div className={styles.skeletonContainer}>
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className={styles.skeletonMessage}>
          <div className={styles.skeletonAvatar} />
          <div className={styles.skeletonBubble} style={{ width: widths[i - 1] }} />
        </div>
      ))}
    </div>
  );
};