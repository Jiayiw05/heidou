import { useCallback, useRef } from 'react';

/**
 * 浏览器内置 SpeechSynthesis API（TTS 语音合成）
 * Chrome/Edge 自带，免费、实时，中文自然流畅
 */
export const useSpeechSynthesis = () => {
  const speakingRef = useRef(false);

  const speak = useCallback((text: string) => {
    if (!text?.trim()) return;

    const synth = window.speechSynthesis;
    if (!synth) {
      console.warn('浏览器不支持 SpeechSynthesis');
      return;
    }

    // 先取消当前正在播报的内容
    synth.cancel();
    speakingRef.current = false;

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'zh-CN';
    utterance.rate = 1.1;   // 稍快一点，更自然
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    // 选中中文语音（优先高质量语音）
    const voices = synth.getVoices();
    const zhVoice =
      voices.find(v => v.lang === 'zh-CN' && v.name.includes('Microsoft')) ||
      voices.find(v => v.lang === 'zh-CN') ||
      voices.find(v => v.lang.startsWith('zh'));

    if (zhVoice) {
      utterance.voice = zhVoice;
    }

    utterance.onstart = () => {
      speakingRef.current = true;
      console.log('[TTS] 开始播报');
    };

    utterance.onend = () => {
      speakingRef.current = false;
      console.log('[TTS] 播报完成');
    };

    utterance.onerror = (e) => {
      speakingRef.current = false;
      console.warn('[TTS] 播报出错:', e.error);
    };

    synth.speak(utterance);
  }, []);

  const stop = useCallback(() => {
    window.speechSynthesis?.cancel();
    speakingRef.current = false;
  }, []);

  const isSpeaking = () => speakingRef.current;

  return { speak, stop, isSpeaking };
};
