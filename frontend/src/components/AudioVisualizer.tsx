import React from 'react';

interface AudioVisualizerProps {
  data: number[];
}

export const AudioVisualizer: React.FC<AudioVisualizerProps> = ({ data }) => {
  // 如果没有数据，显示占位
  if (!data || data.length === 0) {
    return (
      <div className="h-12 flex items-center justify-center space-x-1">
        {Array.from({ length: 32 }).map((_, i) => (
          <div
            key={i}
            className="w-1 bg-gray-700 rounded-full"
            style={{ height: '4px' }}
          />
        ))}
      </div>
    );
  }

  // 计算柱子数量（限制在32个以内）
  const barCount = Math.min(data.length, 32);
  const bars = Array.from({ length: barCount }).map((_, i) => {
    const index = Math.floor(i * (data.length / barCount));
    return data[index] || 0;
  });

  return (
    <div className="h-12 flex items-center justify-center space-x-1">
      {bars.map((value, index) => (
        <div
          key={index}
          className="w-1 bg-purple-ai rounded-full transition-all duration-100 ease-out"
          style={{
            height: `${Math.max(4, value * 48)}px`, // 最小4px，最大48px
            opacity: 0.3 + value * 0.7, // 透明度随音量变化
            boxShadow: value > 0.7 ? '0 0 8px rgba(123, 97, 255, 0.5)' : 'none',
          }}
        />
      ))}
    </div>
  );
};