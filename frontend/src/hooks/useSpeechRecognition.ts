import { useState, useCallback, useRef } from 'react';

interface SpeechRecognitionState {
  isListening: boolean;
  transcript: string;
  error: string | null;
}

/**
 * 浏览器内置 SpeechRecognition API
 * Chrome/Edge 自带，免费、实时、中文识别准确率高
 * 替代本地 Whisper，彻底消除 Python/FFmpeg 依赖和延迟问题
 */
export const useSpeechRecognition = () => {
  const [state, setState] = useState<SpeechRecognitionState>({
    isListening: false,
    transcript: '',
    error: null,
  });

  const recognitionRef = useRef<any>(null);
  // 累积最近的结果用于去重
  const recentResultsRef = useRef<Set<string>>(new Set());
  // 记录最后一次错误类型，用于 onend 判断是否重启
  const lastErrorRef = useRef<string | null>(null);

  const SpeechRecognitionAPI =
    (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

  // 回调：当识别到新文本时调用
  const onResultRef = useRef<((text: string) => void) | null>(null);

  const startListening = useCallback((onResult: (text: string) => void) => {
    if (!SpeechRecognitionAPI) {
      setState(prev => ({ ...prev, error: '浏览器不支持语音识别，请使用 Chrome 或 Edge' }));
      return;
    }

    onResultRef.current = onResult;
    recentResultsRef.current = new Set();
    lastErrorRef.current = null;

    try {
      const recognition = new SpeechRecognitionAPI();
      recognition.lang = 'zh-CN';
      recognition.continuous = true;      // 持续监听
      recognition.interimResults = true;  // 实时返回中间结果
      recognition.maxAlternatives = 1;

      recognition.onresult = (event: any) => {
        let finalText = '';
        let interimText = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) {
            finalText += result[0].transcript;
          } else {
            interimText += result[0].transcript;
          }
        }

        // 最终结果才发送给回调（避免重复触发）
        if (finalText.trim()) {
          const trimmed = finalText.trim();
          // 去重：跳过5秒内已经见过的完全相同结果
          if (!recentResultsRef.current.has(trimmed)) {
            recentResultsRef.current.add(trimmed);
            // 保持集合大小合理
            if (recentResultsRef.current.size > 50) {
              recentResultsRef.current = new Set(
                Array.from(recentResultsRef.current).slice(-30)
              );
            }
            onResultRef.current?.(trimmed);
          }
        }

        setState(prev => ({
          ...prev,
          transcript: finalText || interimText,
        }));
      };

      recognition.onerror = (event: any) => {
        const errorType: string = event.error || '';
        lastErrorRef.current = errorType;

        // 'no-speech' 和 'aborted' 是正常的用户行为，不算错误，静默处理
        if (errorType === 'no-speech' || errorType === 'aborted') {
          return; // 不打印日志、不设错误状态、不触发自动重启
        }

        console.warn('语音识别错误:', errorType);
        setState(prev => ({ ...prev, error: `语音识别错误: ${errorType}` }));

        // 网络类错误才自动重启
        if (errorType === 'network' || errorType === 'service-not-allowed') {
          setTimeout(() => {
            try { recognition.start(); } catch {}
          }, 1000);
        }
      };

      recognition.onend = () => {
        // no-speech / aborted 是正常的暂停，不需要自动重启
        const lastError = lastErrorRef.current;
        if (lastError === 'no-speech' || lastError === 'aborted') {
          recognitionRef.current = null;
          setState({ isListening: false, transcript: '', error: null });
          return;
        }
        // 其他情况自动重启（continuous 模式下某些浏览器会停止）
        if (recognitionRef.current === recognition) {
          try {
            recognition.start();
          } catch {
            // 已经在运行中，忽略
          }
        }
      };

      recognition.start();
      recognitionRef.current = recognition;

      setState({ isListening: true, transcript: '', error: null });
      console.log('浏览器语音识别已启动 (zh-CN)');
    } catch (error) {
      console.error('启动语音识别失败:', error);
      setState(prev => ({ ...prev, error: '启动语音识别失败' }));
    }
  }, [SpeechRecognitionAPI]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.onend = null; // 阻止自动重启
      recognitionRef.current.stop();
      recognitionRef.current = null;
      onResultRef.current = null;
      lastErrorRef.current = null;
      setState({ isListening: false, transcript: '', error: null });
      console.log('浏览器语音识别已停止');
    }
  }, []);

  return {
    ...state,
    startListening,
    stopListening,
    isSupported: !!SpeechRecognitionAPI,
  };
};
