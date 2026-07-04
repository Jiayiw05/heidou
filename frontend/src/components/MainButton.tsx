import React, { useState } from 'react';
import { Mic, Hand } from 'lucide-react';
import { useMeeting } from '../contexts/MeetingContext';

interface MainButtonProps {
  isActive: boolean;
  onStart: () => void;
  onEnd: () => void;
}

export const MainButton: React.FC<MainButtonProps> = ({ isActive, onStart, onEnd }) => {
  const { audioLevel } = useMeeting();
  const [isHovered, setIsHovered] = useState(false);

  const handleClick = () => {
    if (isActive) {
      onEnd();
    } else {
      onStart();
    }
  };

  return (
    <div className="relative">
      {/* 波纹效果 - 仅在监听时显示 */}
      {isActive && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div
            className="absolute w-24 h-24 bg-green-active rounded-full opacity-30 animate-ping"
            style={{
              transform: `scale(${1 + audioLevel * 0.3})`,
            }}
          />
          <div
            className="absolute w-20 h-20 bg-green-active rounded-full opacity-30 animate-ping"
            style={{
              transform: `scale(${1 + audioLevel * 0.2})`,
              animationDelay: '0.2s',
            }}
          />
          <div
            className="absolute w-16 h-16 bg-green-active rounded-full opacity-30 animate-ping"
            style={{
              transform: `scale(${1 + audioLevel * 0.1})`,
              animationDelay: '0.4s',
            }}
          />
        </div>
      )}

      {/* 主按钮 */}
      <button
        onClick={handleClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={`relative w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300 ${
          isActive
            ? 'bg-gray-standby hover:bg-gray-600 border-2 border-gray-600'
            : 'bg-purple-ai hover:bg-purple-600 shadow-lg hover:shadow-purple-ai/25'
        } ${isHovered ? 'scale-105' : 'scale-100'}`}
      >
        {/* 图标 */}
        <div className="flex items-center justify-center">
          {isActive ? (
            <Hand className="w-8 h-8 text-gray-300" />
          ) : (
            <Mic className="w-8 h-8 text-white" />
          )}
        </div>

        {/* 按钮文字 - 显示在按钮下方 */}
        <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 whitespace-nowrap">
          <p className="text-sm font-medium">
            {isActive ? (
              <span className="text-gray-300">下次再会</span>
            ) : (
              <span className="text-white">一起聊聊</span>
            )}
          </p>
        </div>
      </button>

      {/* 提示文字 */}
      {!isActive && (
        <div className="absolute top-full mt-10 text-center">
          <p className="text-xs text-gray-text">点击开始录音</p>
          <p className="text-xs text-gray-text mt-1">说"小五"唤醒助手</p>
        </div>
      )}
    </div>
  );
};