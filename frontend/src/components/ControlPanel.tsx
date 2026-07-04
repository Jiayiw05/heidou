import React, { useState } from 'react';
import { useMeeting } from '../contexts/MeetingContext';
import { MainButton } from './MainButton';
import { Trash2, FileText, Download } from 'lucide-react';
import { exportMeeting } from '../utils/exportMeeting';

export const ControlPanel: React.FC = () => {
  const { isActive, startSession, endSession, clearHistory, analyzeMeeting, messages } = useMeeting();
  const [analyzing, setAnalyzing] = useState(false);

  const handleClearHistory = () => {
    if (window.confirm('确定要清除所有历史记录吗？')) {
      clearHistory();
    }
  };

  const handleAnalyze = () => {
    if (messages.length === 0) {
      alert('暂无会议内容，请先进行对话');
      return;
    }
    setAnalyzing(true);
    analyzeMeeting();
    setTimeout(() => setAnalyzing(false), 30000);
  };

  const handleExport = () => {
    if (messages.length === 0) {
      alert('暂无会议记录可导出');
      return;
    }
    exportMeeting(messages);
  };

  return (
    <div className="h-24 bg-black-primary border-t border-gray-800 flex items-center justify-between px-6">
      {/* 左侧 */}
      <div className="flex items-center space-x-2">
        <button
          onClick={handleClearHistory}
          className="flex items-center space-x-2 px-3 py-2 text-gray-text hover:text-white transition-colors"
          title="清除历史"
        >
          <Trash2 className="w-4 h-4" />
          <span className="text-sm">清除</span>
        </button>
        <button
          onClick={handleExport}
          disabled={messages.length === 0}
          className="flex items-center space-x-2 px-3 py-2 text-gray-text hover:text-white transition-colors
                     disabled:opacity-30 disabled:cursor-not-allowed"
          title="导出会议记录"
        >
          <Download className="w-4 h-4" />
          <span className="text-sm text-nowrap">导出</span>
        </button>
      </div>

      {/* 中间 */}
      <MainButton
        isActive={isActive}
        onStart={startSession}
        onEnd={endSession}
      />

      {/* 右侧 */}
      <button
        onClick={handleAnalyze}
        disabled={analyzing || messages.length === 0}
        className="flex items-center space-x-2 px-3 py-2 text-gray-text hover:text-white transition-colors
                   disabled:opacity-30 disabled:cursor-not-allowed"
        title="会议分析"
      >
        <FileText className="w-4 h-4" />
        <span className="text-sm text-nowrap">{analyzing ? '分析中...' : '分析'}</span>
      </button>
    </div>
  );
};
