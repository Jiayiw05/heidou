import React from 'react';
import { Message } from '../contexts/MeetingContext';
import { User, Bot, Info, Download } from 'lucide-react';

interface MessageBubbleProps {
  message: Message;
}

const exportSingleMessage = (message: Message) => {
  const timestamp = new Date(message.timestamp).toLocaleString('zh-CN');
  const content = [
    '═══════════════════════════════════',
    '  会议小参谋 - 会议记录（单条）',
    `  时间: ${timestamp}`,
    '═══════════════════════════════════',
    '',
    message.text,
    '',
    '═══════════════════════════════════',
  ].join('\n');

  const blob = new Blob(['﻿' + content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `会议记录_${message.id}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const MessageBubble: React.FC<MessageBubbleProps> = ({ message }) => {
  const isUser = message.type === 'user';
  const isSystem = message.type === 'system';

  if (isSystem) {
    return (
      <div className="flex items-center justify-center">
        <div className="flex items-center space-x-2 text-gray-text text-sm py-2">
          <Info className="w-4 h-4" />
          <span>{message.text}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`flex items-start space-x-3 max-w-2xl ${isUser ? 'flex-row-reverse space-x-reverse' : ''}`}>
        {/* 头像 */}
        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
          isUser ? 'bg-gray-700' : 'bg-purple-ai'
        }`}>
          {isUser ? (
            <User className="w-5 h-5 text-gray-300" />
          ) : (
            <Bot className="w-5 h-5 text-white" />
          )}
        </div>

        {/* 消息内容 */}
        <div className={`relative group rounded-lg px-4 py-3 ${
          isUser
            ? 'bg-gray-700 text-white'
            : 'bg-purple-ai bg-opacity-20 text-white border border-purple-ai border-opacity-30'
        }`}>
          <p className="text-sm leading-relaxed font-sans whitespace-pre-wrap break-words pr-6">
            {message.text}
          </p>

          {/* 时间戳 + 导出按钮 */}
          <div className="flex items-center justify-between mt-2">
            <p className="text-xs text-gray-text opacity-70">
              {new Date(message.timestamp).toLocaleTimeString('zh-CN', {
                hour: '2-digit',
                minute: '2-digit'
              })}
            </p>
            {!isUser && (
              <button
                onClick={() => exportSingleMessage(message)}
                className="opacity-0 group-hover:opacity-100 transition-opacity
                           text-gray-text hover:text-white p-1 rounded"
                title="导出此条"
              >
                <Download className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
