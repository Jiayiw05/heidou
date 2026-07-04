import React, { useState, useCallback, useEffect } from 'react';
import { StatusBar } from './components/StatusBar';
import { ConversationStream } from './components/ConversationStream';
import { MessageInput } from './components/MessageInput';
import { ControlPanel } from './components/ControlPanel';
import { ErrorAlert } from './components/ErrorAlert';
import { SocketProvider } from './contexts/SocketContext';
import { MeetingProvider, useMeeting } from './contexts/MeetingContext';
import './App.css';

function AppContent() {
  const { recordingError } = useMeeting();
  const [error, setError] = useState<string | null>(null);

  // 显示录音错误
  useEffect(() => {
    if (recordingError) {
      setError(recordingError);
    }
  }, [recordingError]);

  const handleErrorClose = useCallback(() => {
    setError(null);
  }, []);

  return (
    <>
      <div className="h-screen bg-black-primary text-white flex flex-col">
        {/* 顶部状态栏 */}
        <StatusBar />

        {/* 中部对话流 */}
        <ConversationStream />

        {/* 文字输入框 */}
        <MessageInput />

        {/* 底部控制台 */}
        <ControlPanel />
      </div>

      {/* 错误提示 */}
      <ErrorAlert
        message={error}
        onClose={handleErrorClose}
      />
    </>
  );
}

function App() {
  return (
    <SocketProvider>
      <MeetingProvider>
        <AppContent />
      </MeetingProvider>
    </SocketProvider>
  );
}

export default App;
