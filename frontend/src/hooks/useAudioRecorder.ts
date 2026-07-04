import { useState, useCallback, useRef } from 'react';

export interface AudioRecorderState {
  isRecording: boolean;
  isPaused: boolean;
  audioLevel: number;
  error: string | null;
}

/**
 * 将 Float32 PCM 样本编码为 16-bit WAV 格式
 * 这是后端 Python (Whisper/Silero-VAD) 可以正确解析的格式
 */
function encodeWAV(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = sampleRate * numChannels * bitsPerSample / 8;
  const blockAlign = numChannels * bitsPerSample / 8;

  // 将 Float32 (-1~1) 转换为 Int16
  const pcmData = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }

  const dataSize = pcmData.length * 2;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  // RIFF 头
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, 'WAVE');

  // fmt 子块
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);          // PCM 格式块大小
  view.setUint16(20, 1, true);           // PCM 格式
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);

  // data 子块
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  // 写入 PCM 数据
  const pcmView = new Int16Array(buffer, 44);
  pcmView.set(pcmData);

  return buffer;
}

function writeString(view: DataView, offset: number, str: string): void {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

/**
 * 简单能量检测 VAD（RMS 阈值）
 * 避免每 200ms 小块调用 Python 子进程的开销
 */
function detectSpeechRMS(samples: Float32Array, threshold: number = 0.01): {
  isSpeech: boolean;
  confidence: number;
} {
  let sumSquares = 0;
  for (let i = 0; i < samples.length; i++) {
    sumSquares += samples[i] * samples[i];
  }
  const rms = Math.sqrt(sumSquares / samples.length);
  const normalized = Math.min(1, rms / 0.1); // 归一化到 0~1
  return {
    isSpeech: rms > threshold,
    confidence: normalized,
  };
}

export const useAudioRecorder = () => {
  const [state, setState] = useState<AudioRecorderState>({
    isRecording: false,
    isPaused: false,
    audioLevel: 0,
    error: null
  });

  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // 音频样本缓冲区
  const samplesRef = useRef<Float32Array[]>([]);
  const sampleRateRef = useRef<number>(16000);

  // 最新一帧的 WAV base64（供外部轮询使用）
  const latestAudioBase64Ref = useRef<string | null>(null);

  // 更新音频电平
  const updateAudioLevel = useCallback(() => {
    if (!analyserRef.current) return;

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);

    const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
    const normalizedLevel = average / 255;

    setState(prev => ({ ...prev, audioLevel: normalizedLevel }));

    animationFrameRef.current = requestAnimationFrame(updateAudioLevel);
  }, []);

  // 开始录音
  const startRecording = useCallback(async () => {
    try {
      // 请求麦克风权限
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      streamRef.current = stream;

      // 创建音频上下文（目标采样率 16000Hz）
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 16000,
      });
      audioContextRef.current = audioContext;
      sampleRateRef.current = audioContext.sampleRate;

      // 创建分析器节点用于可视化
      analyserRef.current = audioContext.createAnalyser();
      analyserRef.current.fftSize = 256;

      // 创建 ScriptProcessor 用于捕获原始 PCM 样本
      // bufferSize=4096 → 约 256ms 一帧 (4096/16000)
      const scriptProcessor = audioContext.createScriptProcessor(4096, 1, 1);
      scriptProcessorRef.current = scriptProcessor;

      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyserRef.current);
      source.connect(scriptProcessor);
      scriptProcessor.connect(audioContext.destination);

      // 清空缓冲区
      samplesRef.current = [];

      // 处理音频帧
      scriptProcessor.onaudioprocess = (event) => {
        const inputData = event.inputBuffer.getChannelData(0);
        // 拷贝样本（因为 inputData 会被复用）
        const copy = new Float32Array(inputData.length);
        copy.set(inputData);
        samplesRef.current.push(copy);

        // 限制缓冲区大小（保留最近 10 秒的音频）
        const maxFrames = Math.ceil((10 * sampleRateRef.current) / 4096);
        if (samplesRef.current.length > maxFrames) {
          samplesRef.current = samplesRef.current.slice(-maxFrames);
        }
      };

      updateAudioLevel();

      setState({
        isRecording: true,
        isPaused: false,
        audioLevel: 0,
        error: null
      });

      console.log('录音已开始 (PCM 模式,', audioContext.sampleRate, 'Hz)');
    } catch (error) {
      console.error('开始录音失败:', error);
      setState(prev => ({
        ...prev,
        error: '无法访问麦克风，请检查权限设置'
      }));
    }
  }, [updateAudioLevel]);

  // 停止录音
  const stopRecording = useCallback(() => {
    // 断开音频处理
    if (scriptProcessorRef.current) {
      scriptProcessorRef.current.disconnect();
      scriptProcessorRef.current = null;
    }

    // 停止音频分析
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    // 停止媒体流
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    // 清理音频上下文
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    samplesRef.current = [];
    latestAudioBase64Ref.current = null;
    analyserRef.current = null;

    setState(prev => ({
      ...prev,
      isRecording: false,
      isPaused: false,
      audioLevel: 0
    }));

    console.log('录音已停止');
  }, []);

  // 暂停录音
  const pauseRecording = useCallback(() => {
    if (audioContextRef.current && state.isRecording && !state.isPaused) {
      audioContextRef.current.suspend();
      setState(prev => ({ ...prev, isPaused: true }));
    }
  }, [state.isRecording, state.isPaused]);

  // 恢复录音
  const resumeRecording = useCallback(() => {
    if (audioContextRef.current && state.isRecording && state.isPaused) {
      audioContextRef.current.resume();
      setState(prev => ({ ...prev, isPaused: false }));
    }
  }, [state.isRecording, state.isPaused]);

  // 获取最近 N 秒的音频数据作为 Base64 WAV
  const getAudioBase64 = useCallback((): Promise<string | null> => {
    return new Promise((resolve) => {
      const allSamples = samplesRef.current;
      if (allSamples.length === 0) {
        resolve(null);
        return;
      }

      // 获取最近 5 秒的音频（更长窗口 = 更好识别准确率）
      const framesPerWindow = Math.ceil((5 * sampleRateRef.current) / 4096);
      const recentFrames = allSamples.slice(-framesPerWindow);

      // 合并所有帧
      const totalLength = recentFrames.reduce((sum, f) => sum + f.length, 0);
      const merged = new Float32Array(totalLength);
      let offset = 0;
      for (const frame of recentFrames) {
        merged.set(frame, offset);
        offset += frame.length;
      }

      // 转换为 WAV
      const wavBuffer = encodeWAV(merged, sampleRateRef.current);
      const bytes = new Uint8Array(wavBuffer);

      // 转换为 Base64（分块处理大数组，避免 call stack overflow）
      let binary = '';
      const chunkSize = 8192;
      for (let i = 0; i < bytes.length; i += chunkSize) {
        const chunk = bytes.subarray(i, i + chunkSize);
        binary += String.fromCharCode.apply(null, chunk as any);
      }
      const base64 = btoa(binary);
      resolve(base64);
    });
  }, []);

  // 获取音频 Blob（不再使用 webm，返回 WAV）
  const getAudioBlob = useCallback(async (): Promise<Blob> => {
    const base64 = await getAudioBase64();
    if (!base64) {
      return new Blob([], { type: 'audio/wav' });
    }
    const byteChars = atob(base64);
    const byteNumbers = new Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++) {
      byteNumbers[i] = byteChars.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: 'audio/wav' });
  }, [getAudioBase64]);

  // 清理资源
  const cleanup = useCallback(() => {
    if (state.isRecording) {
      stopRecording();
    }

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
  }, [state.isRecording, stopRecording]);

  return {
    ...state,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    getAudioBlob,
    getAudioBase64,
    cleanup
  };
};
