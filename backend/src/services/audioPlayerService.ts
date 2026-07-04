import EventEmitter from 'events';
import { TTSService, TTSResult } from './ttsService';

export interface PlaybackState {
  isPlaying: boolean;
  isPaused: boolean;
  currentTime: number;
  duration: number;
  volume: number;
}

export class AudioPlayerService extends EventEmitter {
  private tts: TTSService;
  private state: PlaybackState;
  private audioQueue: Array<{ text: string; priority?: number }> = [];
  private isProcessing: boolean = false;
  private currentAudio: Buffer | null = null;
  private interruptFlag: boolean = false;

  constructor(ttsService: TTSService) {
    super();
    this.tts = ttsService;
    this.state = {
      isPlaying: false,
      isPaused: false,
      currentTime: 0,
      duration: 0,
      volume: 1.0
    };
  }

  /**
   * 播放文本
   */
  async speak(text: string, options: { priority?: number; interrupt?: boolean } = {}): Promise<void> {
    if (!text || text.trim().length === 0) {
      return;
    }

    // 检查是否需要中断当前播放
    if (options.interrupt && this.state.isPlaying) {
      this.interrupt();
    }

    // 添加到队列
    this.audioQueue.push({
      text: text.trim(),
      priority: options.priority || 0
    });

    // 按优先级排序
    this.audioQueue.sort((a, b) => (b.priority || 0) - (a.priority || 0));

    // 开始处理队列
    if (!this.isProcessing) {
      this.processQueue();
    }
  }

  /**
   * 中断当前播放
   */
  interrupt(): void {
    this.interruptFlag = true;
    this.state.isPlaying = false;
    this.state.isPaused = false;
    this.currentAudio = null;
    this.emit('interrupted');
  }

  /**
   * 暂停播放
   */
  pause(): void {
    if (this.state.isPlaying && !this.state.isPaused) {
      this.state.isPaused = true;
      this.state.isPlaying = false;
      this.emit('paused');
    }
  }

  /**
   * 恢复播放
   */
  resume(): void {
    if (this.state.isPaused) {
      this.state.isPaused = false;
      this.state.isPlaying = true;
      this.emit('resumed');
    }
  }

  /**
   * 停止播放并清空队列
   */
  stop(): void {
    this.interrupt();
    this.audioQueue = [];
    this.state.currentTime = 0;
    this.state.duration = 0;
    this.emit('stopped');
  }

  /**
   * 设置音量
   */
  setVolume(volume: number): void {
    this.state.volume = Math.max(0, Math.min(1, volume));
    this.emit('volume-changed', this.state.volume);
  }

  /**
   * 获取当前状态
   */
  getState(): PlaybackState {
    return { ...this.state };
  }

  /**
   * 获取队列状态
   */
  getQueueStatus(): {
    length: number;
    isProcessing: boolean;
    currentText?: string;
  } {
    return {
      length: this.audioQueue.length,
      isProcessing: this.isProcessing,
      currentText: this.audioQueue[0]?.text
    };
  }

  /**
   * 处理音频队列
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.audioQueue.length === 0) {
      return;
    }

    this.isProcessing = true;

    while (this.audioQueue.length > 0 && !this.interruptFlag) {
      const item = this.audioQueue.shift()!;
      await this.playText(item.text);
    }

    this.isProcessing = false;
    this.state.isPlaying = false;
    this.emit('queue-finished');
  }

  /**
   * 播放单个文本
   */
  private async playText(text: string): Promise<void> {
    try {
      // 发送开始合成事件
      this.emit('synthesis-start', { text });

      // TTS合成
      const ttsResult = await this.tts.synthesize(text);

      // 发送合成完成事件
      this.emit('synthesis-complete', {
        text,
        duration: ttsResult.duration
      });

      // 检查是否被中断
      if (this.interruptFlag) {
        return;
      }

      // 播放音频
      this.currentAudio = ttsResult.audio;
      this.state.duration = ttsResult.duration;
      this.state.currentTime = 0;
      this.state.isPlaying = true;

      // 发送播放开始事件
      this.emit('playback-start', {
        text,
        duration: ttsResult.duration
      });

      // 模拟播放进度
      await this.simulatePlayback(ttsResult.duration);

      // 播放完成
      if (!this.interruptFlag) {
        this.emit('playback-complete', { text });
      }

    } catch (error) {
      console.error('播放文本失败:', error);
      this.emit('playback-error', { text, error });
    } finally {
      this.currentAudio = null;
      this.state.isPlaying = false;
      this.state.currentTime = 0;
    }
  }

  /**
   * 模拟音频播放
   */
  private async simulatePlayback(duration: number): Promise<void> {
    const startTime = Date.now();
    const updateTimeInterval = 100; // 100ms更新一次

    return new Promise((resolve) => {
      const interval = setInterval(() => {
        if (this.interruptFlag || this.state.isPaused) {
          clearInterval(interval);
          resolve();
          return;
        }

        const elapsed = Date.now() - startTime;
        this.state.currentTime = Math.min(elapsed / 1000, duration);

        // 发送进度更新
        this.emit('progress', {
          currentTime: this.state.currentTime,
          duration: duration,
          progress: this.state.currentTime / duration
        });

        // 播放完成
        if (this.state.currentTime >= duration) {
          clearInterval(interval);
          resolve();
        }
      }, updateTimeInterval);
    });
  }

  /**
   * 流式播放（边合成边播放）
   */
  async speakStream(text: string): Promise<void> {
    try {
      this.emit('synthesis-start', { text, streaming: true });

      // 获取流式音频生成器
      const audioStream = await this.tts.synthesizeStream(text);

      // 逐块播放
      let totalTime = 0;
      for await (const audioChunk of audioStream) {
        if (this.interruptFlag) {
          break;
        }

        // 模拟播放音频块
        const chunkDuration = audioChunk.length / (16000 * 2); // 16kHz, 16-bit
        totalTime += chunkDuration;

        this.emit('streaming-chunk', {
          duration: chunkDuration,
          totalDuration: totalTime
        });

        // 模拟播放时间
        await new Promise(resolve => setTimeout(resolve, chunkDuration * 1000));
      }

      if (!this.interruptFlag) {
        this.emit('playback-complete', { text, streaming: true });
      }
    } catch (error) {
      console.error('流式播放失败:', error);
      this.emit('playback-error', { text, error });
    }
  }

  /**
   * 获取音频可视化数据
   */
  getVisualizationData(): number[] {
    if (!this.currentAudio || !this.state.isPlaying) {
      return new Array(32).fill(0);
    }

    // 简单的音频可视化数据生成
    const data: number[] = [];
    for (let i = 0; i < 32; i++) {
      // 模拟频谱数据
      data.push(Math.random() * 0.8 + 0.2);
    }
    return data;
  }

  /**
   * 清理资源
   */
  cleanup(): void {
    this.stop();
    this.removeAllListeners();
    this.tts.stop();
  }
}