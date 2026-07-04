import fs from 'fs';
import { runPythonScript, toPythonSafePath, createTempAudioPath } from '../utils/pythonBridge';

export interface WhisperOptions {
  language?: string;
  model?: string;
  beam_size?: number;
}

export interface RecognitionResult {
  text: string;
  confidence?: number;
  is_final: boolean;
}

export class WhisperService {
  private defaultOptions: WhisperOptions;

  constructor(options: WhisperOptions = {}) {
    this.defaultOptions = {
      language: 'zh',
      model: 'base',
      beam_size: 5,
      ...options
    };
  }

  async recognize(audioBuffer: Buffer, options?: WhisperOptions): Promise<RecognitionResult> {
    const opts = { ...this.defaultOptions, ...options };
    const tempAudioPath = createTempAudioPath('whisper');

    try {
      fs.writeFileSync(tempAudioPath, audioBuffer);
      const safePath = toPythonSafePath(tempAudioPath);

      const { stdout } = await runPythonScript(`
import whisper
import json
import wave
import numpy as np

model = whisper.load_model("${opts.model}")

# 用 Python 内置 wave 模块读取 WAV（不需要 ffmpeg）
with wave.open(r"${safePath}", "rb") as wf:
    frames = wf.readframes(wf.getnframes())
    # 16-bit PCM → float32 归一化到 [-1, 1]
    audio = np.frombuffer(frames, dtype=np.int16).astype(np.float32) / 32768.0

# 直接传入音频 numpy 数组（不传文件路径），whisper 内部就不会调用 ffmpeg
result = model.transcribe(
    audio,
    language="${opts.language}",
    beam_size=${opts.beam_size}
)

print(json.dumps({"text": result["text"], "language": result["language"]}, ensure_ascii=False))
`, { timeout: 120000 });

      const result = JSON.parse(stdout.trim());
      return {
        text: result.text || '',
        confidence: 0.95,
        is_final: true
      };
    } catch (error) {
      console.error('Whisper识别失败:', (error as Error).message);
      throw error;
    } finally {
      if (fs.existsSync(tempAudioPath)) {
        try { fs.unlinkSync(tempAudioPath); } catch {}
      }
    }
  }

  async recognizeStream(audioBuffers: Buffer[], options?: WhisperOptions): Promise<RecognitionResult> {
    return this.recognize(Buffer.concat(audioBuffers), options);
  }

  detectWakeWord(text: string, wakeWords: string[] = ['小五', '小5', '小屋']): boolean {
    const lowerText = text.toLowerCase();
    return wakeWords.some(word => lowerText.includes(word.toLowerCase()));
  }

  extractWakeWordSegment(text: string): string | null {
    const wakeWords = ['小五', '小5', '小屋'];
    const regex = new RegExp(`.*?(?:${wakeWords.join('|')}).*?`, 'gi');
    const matches = text.match(regex);
    return matches ? matches[0] : null;
  }
}
