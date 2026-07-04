import React, { useEffect, useRef } from 'react';
import { useMeeting } from '../contexts/MeetingContext';
import { MessageBubble } from './MessageBubble';
import { AudioVisualizer } from './AudioVisualizer';

export const ConversationStream: React.FC = () => {
  const { messages, audioVisualization, meetingState } = useMeeting();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 自动滚动到底部
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      {/* 消息列表 */}
      <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center text-gray-text mt-8">
            <p className="text-lg">点击"一起聊聊"开始会议</p>
            <p className="text-sm mt-2">说出"小五"来唤醒助手</p>
          </div>
        ) : (
          messages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* 音频可视化 */}
      {meetingState === 'speaking' && (
        <div className="h-20 px-6 py-4">
          <AudioVisualizer data={audioVisualization.data} />
        </div>
      )}

      {/* 系统提示 */}
      {meetingState === 'thinking' && (
        <div className="px-6 py-4">
          <div className="bg-purple-ai bg-opacity-20 rounded-lg px-4 py-3 flex items-center space-x-3">
            <div className="w-2 h-2 bg-purple-ai rounded-full animate-pulse" />
            <span className="text-purple-ai text-sm">小五正在整理语音...</span>
          </div>
        </div>
      )}
    </div>
  );
};