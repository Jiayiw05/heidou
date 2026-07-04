import React from 'react';
import { useMeeting } from '../contexts/MeetingContext';
import { Mic, MicOff, Volume2 } from 'lucide-react';

export const StatusBar: React.FC = () => {
  const { meetingState } = useMeeting();

  // 获取状态指示器样式
  const getStatusIndicatorStyle = () => {
    switch (meetingState) {
      case 'idle':
        return 'w-3 h-3 bg-gray-600';
      case 'listening':
        return 'w-3 h-3 bg-green-active animate-pulse';
      case 'thinking':
        return 'w-3 h-3 bg-purple-ai animate-pulse';
      case 'speaking':
        return 'w-3 h-3 bg-purple-ai';
      default:
        return 'w-3 h-3 bg-gray-600';
    }
  };

  // 获取状态文本
  const getStatusText = () => {
    switch (meetingState) {
      case 'idle':
        return '待机中';
      case 'listening':
        return '监听中';
      case 'thinking':
        return '思考中';
      case 'speaking':
        return '播报中';
      default:
        return '待机中';
    }
  };

  return (
    <div className="h-16 bg-black-primary border-b border-gray-800 flex items-center justify-between px-6">
      {/* 标题和状态指示器 */}
      <div className="flex items-center space-x-3">
        <h1 className="text-xl font-medium text-white">会议小参谋</h1>
        <div className="flex items-center space-x-2">
          <div className={`${getStatusIndicatorStyle()} rounded-full transition-all duration-300`} />
          <span className="text-sm text-gray-text">{getStatusText()}</span>
        </div>
      </div>

      {/* 右侧图标区域 */}
      <div className="flex items-center space-x-4">
        {/* 音量图标 */}
        <Volume2 className="w-5 h-5 text-gray-text" />

        {/* 连接状态 */}
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 bg-green-active rounded-full" />
          <span className="text-xs text-gray-text">已连接</span>
        </div>
      </div>
    </div>
  );
};