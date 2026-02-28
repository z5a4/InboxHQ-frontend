// src/components/PendingRequests.jsx
import { useState, useEffect } from 'react';
import api from '../utils/api.js';
import ChatRequest from './ChatRequest.jsx';
import styles from './PendingRequest.module.css';

export default function PendingRequests({ onRequestUpdate }) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    try {
      const res = await api.get('/chat/pending-requests');
      setRequests(res.data.requests || []);
    } catch (error) {
      console.error('Error fetching requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRespond = (requestId, status) => {
    setRequests(prev => prev.filter(r => r._id !== requestId));
    if (status === 'accepted' && onRequestUpdate) {
      onRequestUpdate();
    }
  };

  if (loading) {
    return (
      <div className={styles.skeleton}>
        {[1, 2].map(i => (
          <div key={i} className={styles.skeletonItem} />
        ))}
      </div>
    );
  }

  if (requests.length === 0) {
    return null;
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.title}>Chat Requests</span>
        <span className={styles.count}>{requests.length}</span>
      </div>
      <div className={styles.list}>
        {requests.map(request => (
          <ChatRequest
            key={request._id}
            request={request}
            onRespond={handleRespond}
          />
        ))}
      </div>
    </div>
  );
}