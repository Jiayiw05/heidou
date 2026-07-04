import React, { createContext, useContext, useEffect, useState } from 'react';
import { useSocket } from './SocketContext';
import { useAudioRecorder } from '../hooks/useAudioRecorder';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';
import { useSpeechSynthesis } from '../hooks/useSpeechSynthesis';

export type MeetingState = 'idle' | 'listening' | 'thinking' | 'speaking';

export interface Message {
  id: string;
  type: 'user' | 'assistant' | 'system';
  text: string;
  timestamp: number;
  isWakeWord?: boolean;
}

export interface AudioVisualization {
  data: number[];
  isPlaying: boolean;
}

interface MeetingContextType {
  meetingState: MeetingState;
  isActive: boolean;
  messages: Message[];
  audioVisualization: AudioVisualization;
  audioLevel: number;
  recordingError: string | null;

  startSession: () => void;
  endSession: () => void;
  clearHistory: () => void;
  sendMessage: (message: string) => void;
  interruptAudio: () => void;
  analyzeMeeting: () => void;
}

const MeetingContext = createContext<MeetingContextType>({
  meetingState: 'idle',
  isActive: false,
  messages: [],
  audioVisualization: { data: [], isPlaying: false },
  audioLevel: 0,
  recordingError: null,
  startSession: () => {},
  endSession: () => {},
  clearHistory: () => {},
  sendMessage: () => {},
  interruptAudio: () => {},
  analyzeMeeting: () => {},
});

export const useMeeting = () => useContext(MeetingContext);

export const MeetingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const socket = useSocket();
  const audioRecorder = useAudioRecorder();
  const speechRecognition = useSpeechRecognition();
  const speechSynthesis = useSpeechSynthesis();
  const [meetingState, setMeetingState] = useState<MeetingState>('idle');
  const [isActive, setIsActive] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [audioVisualization, setAudioVisualization] = useState<AudioVisualization>({
    data: [],
    isPlaying: false
  });

  // Socket 事件监听
  useEffect(() => {
    if (!socket.socket) return;

    socket.joinRoom('meeting-room-1');

    socket.socket.on('speech-start', () => {
      setMeetingState('listening');
    });

    socket.socket.on('speech-end', () => {
      if (meetingState === 'listening') setMeetingState('idle');
    });

    socket.socket.on('transcription', (data) => {
      const message: Message = {
        id: Date.now().toString(),
        type: 'user',
        text: data.text,
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, message]);
    });

    socket.socket.on('ai-thinking', () => {
      console.log('[前端] 收到 ai-thinking，状态 → thinking');
      setMeetingState('thinking');
      // 添加空的AI消息占位，后续流式填充
      const placeholder: Message = {
        id: 'streaming-' + Date.now().toString(),
        type: 'assistant',
        text: '',
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, placeholder]);
    });

    // 流式输出：逐字更新
    socket.socket.on('ai-chunk', (data: { chunk: string; fullResponse: string }) => {
      setMessages(prev => {
        const updated = [...prev];
        // 找到最后一个 assistant 消息，用流式内容更新
        for (let i = updated.length - 1; i >= 0; i--) {
          if (updated[i].type === 'assistant' && updated[i].id.startsWith('streaming-')) {
            updated[i] = { ...updated[i], text: data.fullResponse };
            break;
          }
        }
        return updated;
      });
    });

    // 流式完成
    socket.socket.on('ai-stream-complete', (data: { text: string }) => {
      console.log('[前端] 流式完成:', data.text?.slice(0, 50));
      // 去掉 streaming- 标记，转为正式消息
      setMessages(prev => {
        const updated = [...prev];
        for (let i = updated.length - 1; i >= 0; i--) {
          if (updated[i].type === 'assistant' && updated[i].id.startsWith('streaming-')) {
            updated[i] = { ...updated[i], id: Date.now().toString(), text: data.text };
            break;
          }
        }
        return updated;
      });
      // TTS 播报
      if (data.text) {
        setMeetingState('speaking');
        speechSynthesis.speak(data.text);
        const estimatedDuration = (data.text.length / 4) * 1000;
        setTimeout(() => {
          setMeetingState(prev => prev === 'speaking' ? 'idle' : prev);
        }, Math.max(estimatedDuration, 2000));
      }
    });

    // 非流式回复（语音唤醒词用）
    socket.socket.on('ai-response', (data) => {
      console.log('[前端] 收到 ai-response:', data.text?.slice(0, 50));
      const message: Message = {
        id: Date.now().toString(),
        type: 'assistant',
        text: data.text,
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, message]);
      setMeetingState('speaking');
      speechSynthesis.speak(data.text);
      const estimatedDuration = (data.text.length / 4) * 1000;
      setTimeout(() => {
        setMeetingState(prev => prev === 'speaking' ? 'idle' : prev);
      }, Math.max(estimatedDuration, 2000));
    });

    socket.socket.on('wake-word-detected', (data) => {
      console.log('[前端] 收到 wake-word-detected');
      const message: Message = {
        id: Date.now().toString(),
        type: 'system',
        text: '🔔 检测到唤醒词',
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, message]);
    });

    socket.socket.on('tts-start', () => {
      setMeetingState('thinking');
    });

    socket.socket.on('audio-start', () => {
      setMeetingState('speaking');
      setAudioVisualization(prev => ({ ...prev, isPlaying: true }));
    });

    socket.socket.on('audio-complete', () => {
      setMeetingState('idle');
      setAudioVisualization({ data: [], isPlaying: false });
    });

    socket.socket.on('audio-interrupted', () => {
      setMeetingState('idle');
      setAudioVisualization({ data: [], isPlaying: false });
    });

    socket.socket.on('analysis-start', () => {
      console.log('[前端] 会议分析开始');
      setMeetingState('thinking');
    });

    socket.socket.on('analysis-result', (analysis: {
      summary: string;
      keyPoints: string[];
      decisions: string[];
      actionItems: string[];
    }) => {
      console.log('[前端] 会议分析完成');
      const text = [
        '📋 **会议总结**',
        analysis.summary || '(无)',
        '',
        '🔑 **关键要点**',
        ...(analysis.keyPoints?.length ? analysis.keyPoints.map((p: string) => `• ${p}`) : ['(无)']),
        '',
        '✅ **决策**',
        ...(analysis.decisions?.length ? analysis.decisions.map((d: string) => `• ${d}`) : ['(无)']),
        '',
        '📝 **行动项**',
        ...(analysis.actionItems?.length ? analysis.actionItems.map((a: string) => `• ${a}`) : ['(无)']),
      ].join('\n');
      const message: Message = {
        id: Date.now().toString(),
        type: 'assistant',
        text,
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, message]);
      setMeetingState('idle');
    });

    socket.socket.on('audio-visualization', (data) => {
      setAudioVisualization(prev => ({
        ...prev,
        data: Array.isArray(data) ? data : []
      }));
    });

    socket.socket.emit('get-history');
    socket.socket.on('history', (history) => {
      setMessages(history.map((msg: any) => ({
        ...msg,
        id: Date.now().toString() + Math.random()
      })));
    });

    return () => {
      socket.socket?.off('speech-start');
      socket.socket?.off('speech-end');
      socket.socket?.off('transcription');
      socket.socket?.off('ai-thinking');
      socket.socket?.off('ai-response');
      socket.socket?.off('ai-chunk');
      socket.socket?.off('ai-stream-complete');
      socket.socket?.off('analysis-start');
      socket.socket?.off('analysis-result');
      socket.socket?.off('tts-start');
      socket.socket?.off('audio-start');
      socket.socket?.off('audio-complete');
      socket.socket?.off('audio-interrupted');
      socket.socket?.off('audio-visualization');
      socket.socket?.off('wake-word-detected');
      socket.socket?.off('history');
    };
  }, [socket.socket]);

  // 开始会话
  const startSession = () => {
    setIsActive(true);
    setMeetingState('listening');
    console.log('会话已开始');

    // 启动音频录音（用于可视化）
    audioRecorder.startRecording();

    // 启动浏览器语音识别（用于转文字 + 唤醒词）
    speechRecognition.startListening((text: string) => {
      console.log(`[浏览器ASR] 识别: "${text}"`);
      if (socket.socket) {
        socket.socket.emit('voice-text', { text });
      }
    });
  };

  // 结束会话
  const endSession = () => {
    setIsActive(false);
    setMeetingState('idle');
    audioRecorder.stopRecording();
    speechRecognition.stopListening();
    speechSynthesis.stop();
    socket.socket?.emit('interrupt-audio');
    console.log('会话已结束');
  };

  // 清除历史
  const clearHistory = () => {
    setMessages([]);
    socket.socket?.emit('clear-history');
    socket.socket?.emit('clear-ai-conversation');
  };

  // 发送消息（流式）
  const sendMessage = (message: string) => {
    if (!message.trim()) return;

    socket.socket?.emit('ai-chat-stream', {
      message: message.trim(),
      speak: true,
      interrupt: true
    });

    const msg: Message = {
      id: Date.now().toString(),
      type: 'user',
      text: message.trim(),
      timestamp: Date.now()
    };
    setMessages(prev => [...prev, msg]);
  };

  // 中断音频
  const interruptAudio = () => {
    socket.socket?.emit('interrupt-audio');
  };

  // 会议分析
  const analyzeMeeting = () => {
    console.log('[前端] 触发会议分析');
    setMeetingState('thinking');
    socket.socket?.emit('analyze-meeting');
  };

  return (
    <MeetingContext.Provider
      value={{
        meetingState,
        isActive,
        messages,
        audioVisualization,
        startSession,
        endSession,
        clearHistory,
        sendMessage,
        interruptAudio,
        analyzeMeeting,
        audioLevel: audioRecorder.audioLevel,
        recordingError: audioRecorder.error || speechRecognition.error
      }}
    >
      {children}
    </MeetingContext.Provider>
  );
};
