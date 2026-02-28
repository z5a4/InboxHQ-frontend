// src/components/ChatRequest.jsx
import { useState } from 'react';
import api from '../utils/api.js';
import Avatar from './Avatar.jsx';
import styles from './ChatRequest.module.css';

export default function ChatRequest({ request, onRespond }) {
  const [responding, setResponding] = useState(false);
  const otherUser = request.otherParticipant;

  const handleRespond = async (status) => {
    setResponding(true);
    try {
      await api.put(`/chat/conversations/${request._id}/respond`, { status });
      onRespond(request._id, status);
    } catch (error) {
      console.error('Error responding to request:', error);
    } finally {
      setResponding(false);
    }
  };

  const formattedDate = new Date(request.createdAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  return (
    <div className={styles.request}>
      <div className={styles.requestHeader}>
        <Avatar user={otherUser} size={44} />
        <div className={styles.requestInfo}>
          <span className={styles.requestName}>
            {otherUser?.displayName || otherUser?.username}
          </span>
          <span className={styles.requestTime}>{formattedDate}</span>
        </div>
      </div>
      
      <p className={styles.requestMessage}>
        wants to start a conversation with you
      </p>

      <div className={styles.requestActions}>
        <button
          className={`${styles.actionBtn} ${styles.acceptBtn}`}
          onClick={() => handleRespond('accepted')}
          disabled={responding}
        >
          {responding ? 'Processing...' : '✓ Accept'}
        </button>
        <button
          className={`${styles.actionBtn} ${styles.declineBtn}`}
          onClick={() => handleRespond('declined')}
          disabled={responding}
        >
          ✕ Decline
        </button>
      </div>
    </div>
  );
}