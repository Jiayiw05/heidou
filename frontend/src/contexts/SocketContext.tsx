import React, { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  roomId: string;
  joinRoom: (roomId: string) => void;
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false,
  roomId: '',
  joinRoom: () => {},
});

export const useSocket = () => useContext(SocketContext);

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [roomId, setRoomId] = useState('');

  useEffect(() => {
    // 生产环境用当前页面地址，开发环境用 localhost:3001
    const serverUrl = process.env.REACT_APP_API_URL || window.location.origin;
    const newSocket = io(serverUrl);

    newSocket.on('connect', () => {
      console.log('已连接到服务器');
      setIsConnected(true);
    });

    newSocket.on('disconnect', () => {
      console.log('已断开连接');
      setIsConnected(false);
    });

    setSocket(newSocket);

    // 清理
    return () => {
      newSocket.close();
    };
  }, []);

  const joinRoom = (newRoomId: string) => {
    if (socket) {
      socket.emit('join-room', newRoomId);
      setRoomId(newRoomId);
    }
  };

  return (
    <SocketContext.Provider value={{ socket, isConnected, roomId, joinRoom }}>
      {children}
    </SocketContext.Provider>
  );
};