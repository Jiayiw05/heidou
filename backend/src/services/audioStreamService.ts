import EventEmitter from 'events';
import { WhisperService } from './whisperService';

export interface AudioStreamConfig {
  sampleRate: number;
  channels: number;
}

export interface StreamEvent {
  type: 'speech-start' | 'speech-end' | 'text' | 'wake-word' | 'error';
  data: any;
  timestamp: number;
}

export class AudioStreamService extends EventEmitter {
  private whisper: WhisperService;
  private config: AudioStreamConfig;
  private audioBuffer: Buffer[] = [];
  private isProcessing: boolean = false;
  private pendingChunks: Buffer[] = [];
  private lastRecognitionTime: number = 0;
  private recognitionInterval: number = 5000; // 每5秒识别一次
  private minBuffersForRecognition: number = 1; // 收到一块就识别（每块5秒足够）

  constructor(config: Partial<AudioStreamConfig> = {}) {
    super();

    this.config = {
      sampleRate: 16000,
      channels: 1,
      ...config
    };

    this.whisper = new WhisperService({
      language: 'zh',
      model: 'base',
      beam_size: 5
    });

    console.log('[AudioStream] 初始化完成（VAD已绕过，5秒窗口直接识别）');
  }

  /**
   * 处理音频数据块
   * 绕过 VAD，采用定时积累 → Whisper 识别的简化流程
   */
  async processAudioChunk(audioChunk: Buffer): Promise<void> {
    // 如果正在处理中，暂存新块
    if (this.isProcessing) {
      this.pendingChunks.push(audioChunk);
      if (this.pendingChunks.length > 30) {
        this.pendingChunks = this.pendingChunks.slice(-20);
      }
      return;
    }

    this.audioBuffer.push(audioChunk);

    // 保留最近 ~15 秒音频（每块约 5 秒，保留 3 块）
    if (this.audioBuffer.length > 3) {
      this.audioBuffer = this.audioBuffer.slice(-3);
    }

    const now = Date.now();
    // 积累够 2 块（约10秒音频）或距上次识别超时触发
    if (this.audioBuffer.length >= this.minBuffersForRecognition ||
        (now - this.lastRecognitionTime > this.recognitionInterval && this.audioBuffer.length > 0)) {
      await this.runRecognition();
    }
  }

  private async runRecognition(): Promise<void> {
    if (this.audioBuffer.length === 0) return;

    this.isProcessing = true;
    this.emitEvent('speech-start', {});

    try {
      const fullAudio = Buffer.concat(this.audioBuffer);
      this.audioBuffer = [];
      this.lastRecognitionTime = Date.now();

      console.log(`[AudioStream] 开始识别，音频大小=${fullAudio.length}字节 (${(fullAudio.length / 1024).toFixed(1)}KB)`);

      const result = await this.whisper.recognize(fullAudio);

      if (result.text && result.text.trim()) {
        console.log(`[AudioStream] 识别结果: "${result.text}"`);

        this.emitEvent('text', {
          text: result.text,
          confidence: result.confidence,
          is_final: result.is_final
        });

        if (this.whisper.detectWakeWord(result.text)) {
          const wakeWordSegment = this.whisper.extractWakeWordSegment(result.text);
          console.log(`[AudioStream] 🔔 检测到唤醒词!`);
          this.emitEvent('wake-word', {
            text: result.text,
            wakeWord: wakeWordSegment,
            timestamp: Date.now()
          });
        }
      } else {
        console.log('[AudioStream] 识别结果为空');
      }
    } catch (error) {
      console.error('[AudioStream] 语音识别失败:', (error as Error).message);
      this.emitEvent('error', { message: '语音识别失败', error });
    } finally {
      this.emitEvent('speech-end', {});
      this.isProcessing = false;

      // 处理积压的音频块
      if (this.pendingChunks.length > 0) {
        const chunks = this.pendingChunks.splice(0);
        for (const chunk of chunks) {
          this.audioBuffer.push(chunk);
        }
      }
    }
  }

  async forceProcess(): Promise<void> {
    if (this.audioBuffer.length > 0) {
      await this.runRecognition();
    }
  }

  clearBuffer(): void {
    this.audioBuffer = [];
    this.pendingChunks = [];
    this.lastRecognitionTime = 0;
  }

  getStatus(): {
    isProcessing: boolean;
    bufferSize: number;
    lastRecognitionTime: number | null;
  } {
    return {
      isProcessing: this.isProcessing,
      bufferSize: this.audioBuffer.length,
      lastRecognitionTime: this.lastRecognitionTime || null
    };
  }

  private emitEvent(type: StreamEvent['type'], data: any): void {
    this.emit('stream-event', { type, data, timestamp: Date.now() });
    this.emit(type, data);
  }

  stop(): void {
    this.clearBuffer();
    this.removeAllListeners();
  }
}
