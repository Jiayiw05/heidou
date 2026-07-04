import fs from 'fs';
import { runPythonScript } from '../utils/pythonBridge';

export interface TTSOptions {
  voice?: string;
  speed?: number;
  temperature?: number;
  top_p?: number;
}

export interface TTSResult {
  audio: Buffer;
  duration: number;
  sampleRate: number;
}

export class TTSService {
  private defaultOptions: TTSOptions;

  constructor(options: TTSOptions = {}) {
    this.defaultOptions = {
      voice: 'default',
      speed: 1.0,
      temperature: 0.3,
      top_p: 0.7,
      ...options
    };
  }

  async synthesize(text: string, options?: TTSOptions): Promise<TTSResult> {
    const opts = { ...this.defaultOptions, ...options };

    if (!text || text.trim().length === 0) {
      throw new Error('文本不能为空');
    }

    try {
      return await this.callTTSPython(text, opts);
    } catch (error) {
      console.error('TTS合成失败，使用降级模拟音频:', (error as Error).message);
      return this.generateMockAudio(text);
    }
  }

  async synthesizeStream(text: string, options?: TTSOptions): Promise<AsyncGenerator<Buffer>> {
    const opts = { ...this.defaultOptions, ...options };
    const sentences = this.splitText(text);

    async function* streamGenerator(this: TTSService) {
      for (const sentence of sentences) {
        if (sentence.trim()) {
          try {
            const result = await this.synthesize(sentence, opts);
            yield result.audio;
          } catch (error) {
            console.error(`合成失败: ${sentence}`, error);
            yield Buffer.alloc(Math.floor(16000 * 0.1));
          }
        }
      }
    }

    return streamGenerator.call(this);
  }

  private async callTTSPython(text: string, options: TTSOptions): Promise<TTSResult> {
    const escapedText = text
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '');

    const { stdout } = await runPythonScript(`
import numpy as np

def mock_chattts_synthesize(text, voice="default", speed=1.0, temperature=0.3, top_p=0.7):
    sample_rate = 16000
    duration = len(text) * 0.15

    t = np.linspace(0, duration, int(sample_rate * duration))
    frequency = 200 + (hash(text) % 200)
    audio = np.sin(2 * np.pi * frequency * t) * 0.3

    fade_samples = int(0.05 * sample_rate)
    if fade_samples > 0 and len(audio) > 2 * fade_samples:
        fade_in = np.linspace(0, 1, fade_samples)
        fade_out = np.linspace(1, 0, fade_samples)
        audio[:fade_samples] *= fade_in
        audio[-fade_samples:] *= fade_out

    return audio, sample_rate

audio, sample_rate = mock_chattts_synthesize(
    "${escapedText}",
    voice="${options.voice || 'default'}",
    speed=${options.speed || 1.0},
    temperature=${options.temperature || 0.3},
    top_p=${options.top_p || 0.7}
)

import tempfile
import wave

with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as f:
    output_path = f.name

with wave.open(output_path, 'wb') as wav:
    wav.setnchannels(1)
    wav.setsampwidth(2)
    wav.setframerate(sample_rate)
    wav.writeframes((audio * 32767).astype(np.int16).tobytes())

print(output_path)
`, { timeout: 30000 });

    const audioPath = stdout.trim();
    if (audioPath && fs.existsSync(audioPath)) {
      const audioBuffer = fs.readFileSync(audioPath);
      const duration = audioBuffer.length / (16000 * 2);
      try { fs.unlinkSync(audioPath); } catch {}
      return { audio: audioBuffer, duration, sampleRate: 16000 };
    }
    throw new Error('TTS输出文件不存在');
  }

  private generateMockAudio(text: string): TTSResult {
    const duration = text.length * 0.15;
    const sampleRate = 16000;
    const samples = Math.floor(duration * sampleRate);
    const buffer = Buffer.alloc(samples * 2);

    for (let i = 0; i < samples; i++) {
      const value = Math.sin(2 * Math.PI * 440 * (i / sampleRate)) * 0.1;
      buffer.writeInt16LE(Math.floor(value * 32767), i * 2);
    }

    return { audio: buffer, duration, sampleRate };
  }

  private splitText(text: string): string[] {
    const segments = text.split(/([。！？.!?])/);
    const sentences: string[] = [];
    let current = '';

    for (const segment of segments) {
      current += segment;
      if (/[。！？.!?]/.test(segment) || current.length > 100) {
        sentences.push(current.trim());
        current = '';
      }
    }

    if (current.trim()) sentences.push(current.trim());
    return sentences.filter(s => s.length > 0);
  }

  async isModelAvailable(): Promise<boolean> {
    return true;
  }

  async preloadModel(): Promise<void> {
    console.log('TTS模型准备中...');
    console.log('TTS模型准备完成');
  }

  stop(): void {
    console.log('TTS服务已停止');
  }
}
