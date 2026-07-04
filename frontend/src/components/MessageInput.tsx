import React, { useState, useRef } from 'react';
import { Send } from 'lucide-react';
import { useMeeting } from '../contexts/MeetingContext';

export const MessageInput: React.FC = () => {
  const { sendMessage } = useMeeting();
  const [text, setText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    sendMessage(trimmed);
    setText('');
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="px-4 py-3 border-t border-gray-800 bg-black-primary">
      <div className="flex items-center space-x-3 max-w-2xl mx-auto">
        <input
          ref={inputRef}
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="输入文字，按 Enter 发送..."
          className="flex-1 bg-gray-900 text-white rounded-full px-5 py-2.5 text-sm
                     placeholder-gray-text border border-gray-700
                     focus:outline-none focus:border-purple-ai transition-colors"
        />
        <button
          onClick={handleSend}
          disabled={!text.trim()}
          className="w-10 h-10 rounded-full bg-purple-ai hover:bg-purple-600
                     flex items-center justify-center transition-colors
                     disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Send className="w-4 h-4 text-white" />
        </button>
      </div>
    </div>
  );
};
