import { useEffect, useRef } from 'react';
import { getSocket } from '../utils/socket.js';

export const useSocket = (events) => {
  const eventsRef = useRef(events);
  eventsRef.current = events;

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handlers = {};
    Object.entries(eventsRef.current).forEach(([event, handler]) => {
      handlers[event] = (...args) => handler(...args);
      socket.on(event, handlers[event]);
    });

    return () => {
      Object.entries(handlers).forEach(([event, handler]) => {
        socket.off(event, handler);
      });
    };
  }, []);
};