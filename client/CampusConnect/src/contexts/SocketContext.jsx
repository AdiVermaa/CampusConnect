import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { API_BASE_URL } from '../config';
import { getAccessToken } from '../api/auth';

const SocketContext = createContext(null);

export const useSocket = () => {
    const context = useContext(SocketContext);
    if (!context) {
        throw new Error('useSocket must be used within a SocketProvider');
    }
    return context;
};

export const SocketProvider = ({ children }) => {
    const socketRef = useRef(null);
    const [isConnected, setIsConnected] = useState(false);
    const listenersRef = useRef(new Map());

    useEffect(() => {
        const token = getAccessToken();

        if (!token) {
            console.log(' No token available, skipping socket connection');
            return;
        }

        console.log('🔌 Initializing socket connection...');
        socketRef.current = io(API_BASE_URL, {
            auth: { token },
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionAttempts: 5
        });

        socketRef.current.on('connect', () => {
            console.log(' Socket connected');
            setIsConnected(true);
        });

        socketRef.current.on('disconnect', () => {
            console.log(' Socket disconnected');
            setIsConnected(false);
        });

        socketRef.current.on('connect_error', (error) => {
            console.error('Socket connection error:', error);
        });

        return () => {
            if (socketRef.current) {
                console.log(' Disconnecting socket');
                socketRef.current.disconnect();
                socketRef.current = null;
            }
        };
    }, []);

    const on = (event, callback) => {
        if (!socketRef.current) return;

        if (!listenersRef.current.has(event)) {
            listenersRef.current.set(event, new Set());
        }
        listenersRef.current.get(event).add(callback);

        socketRef.current.on(event, callback);

        return () => {
            if (socketRef.current) {
                socketRef.current.off(event, callback);
            }
            const listeners = listenersRef.current.get(event);
            if (listeners) {
                listeners.delete(callback);
                if (listeners.size === 0) {
                    listenersRef.current.delete(event);
                }
            }
        };
    };

    const emit = (event, data) => {
        if (!socketRef.current) {
            console.warn('Socket not connected, cannot emit:', event);
            return;
        }
        socketRef.current.emit(event, data);
    };

    const off = (event, callback) => {
        if (!socketRef.current) return;
        socketRef.current.off(event, callback);

        const listeners = listenersRef.current.get(event);
        if (listeners) {
            listeners.delete(callback);
            if (listeners.size === 0) {
                listenersRef.current.delete(event);
            }
        }
    };

    const value = {
        socket: socketRef.current,
        isConnected,
        on,
        off,
        emit
    };

    return (
        <SocketContext.Provider value={value}>
            {children}
        </SocketContext.Provider>
    );
};
