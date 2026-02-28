import { useState, useEffect } from 'react';
import { getSocket } from '../utils/socket.js';

export const useOnlineUsers = () => {
  const [onlineUsers, setOnlineUsers] = useState({});

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const onOnline = ({ userId }) => {
      setOnlineUsers((prev) => ({ ...prev, [userId]: true }));
    };

    const onOffline = ({ userId }) => {
      setOnlineUsers((prev) => ({ ...prev, [userId]: false }));
    };

    socket.on('user:online', onOnline);
    socket.on('user:offline', onOffline);

    return () => {
      socket.off('user:online', onOnline);
      socket.off('user:offline', onOffline);
    };
  }, []);

  const isOnline = (userId) => !!onlineUsers[userId];

  return { onlineUsers, isOnline };
};