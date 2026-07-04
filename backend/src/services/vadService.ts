import fs from 'fs';
import { runPythonScript, toPythonSafePath, createTempAudioPath } from '../utils/pythonBridge';

export interface VADResult {
  is_speech: boolean;
  confidence: number;
  timestamp: number;
}

export interface VADConfig {
  sample_rate: number;
  window_size: number;
  threshold: number;
}

export class VADService {
  private config: VADConfig;
  private modelLoaded: boolean = false;

  constructor(config: Partial<VADConfig> = {}) {
    this.config = {
      sample_rate: 16000,
      window_size: 1024,
      threshold: 0.5,
      ...config
    };
    this.loadModel();
  }

  private async loadModel(): Promise<void> {
    if (this.modelLoaded) return;
    this.modelLoaded = true;
    console.log('VAD模型已加载');
  }

  async detect(audioBuffer: Buffer): Promise<VADResult> {
    if (!this.modelLoaded) {
      await this.loadModel();
    }

    const tempAudioPath = createTempAudioPath('vad');

    try {
      fs.writeFileSync(tempAudioPath, audioBuffer);
      const safePath = toPythonSafePath(tempAudioPath);

      const { stdout } = await runPythonScript(`
import torch
import json
import sys

try:
    from silero_vad import load_silero_vad, read_audio, get_speech_timestamps

    model = load_silero_vad()
    wav = read_audio(r"${safePath}")

    speech_timestamps = get_speech_timestamps(
        wav,
        model,
        threshold=${this.config.threshold}
    )

    total_duration = len(wav) / 16000.0
    speech_duration = sum(end - start for start, end in speech_timestamps) / 16000.0
    speech_ratio = speech_duration / total_duration if total_duration > 0 else 0

    result = {
        "is_speech": len(speech_timestamps) > 0,
        "confidence": float(speech_ratio),
        "timestamp": ${Date.now()}
    }
except ImportError as e:
    result = {"is_speech": False, "confidence": 0, "timestamp": ${Date.now()}}

print(json.dumps(result))
`);

      const parsed = JSON.parse(stdout.trim());
      return {
        is_speech: parsed.is_speech || false,
        confidence: parsed.confidence || 0,
        timestamp: parsed.timestamp || Date.now(),
      };
    } catch (error) {
      console.error('VAD检测失败:', (error as Error).message);
      return { is_speech: false, confidence: 0, timestamp: Date.now() };
    } finally {
      if (fs.existsSync(tempAudioPath)) {
        try { fs.unlinkSync(tempAudioPath); } catch {}
      }
    }
  }

  async detectBatch(audioBuffers: Buffer[]): Promise<VADResult[]> {
    const results: VADResult[] = [];
    for (const buffer of audioBuffers) {
      results.push(await this.detect(buffer));
    }
    return results;
  }

  async extractSpeechSegments(
    audioBuffers: Buffer[],
    maxSilenceDuration: number = 1000
  ): Promise<Buffer[]> {
    const vadResults = await this.detectBatch(audioBuffers);
    const speechSegments: Buffer[] = [];
    let currentSegment: Buffer[] = [];
    let silenceStart: number | null = null;

    for (let i = 0; i < audioBuffers.length; i++) {
      const result = vadResults[i];
      const buffer = audioBuffers[i];

      if (result.is_speech) {
        if (silenceStart !== null) {
          if (Date.now() - silenceStart > maxSilenceDuration && currentSegment.length > 0) {
            speechSegments.push(Buffer.concat(currentSegment));
            currentSegment = [];
          }
        }
        currentSegment.push(buffer);
        silenceStart = null;
      } else {
        if (silenceStart === null && currentSegment.length > 0) {
          silenceStart = Date.now();
        }
      }
    }

    if (currentSegment.length > 0) {
      speechSegments.push(Buffer.concat(currentSegment));
    }

    return speechSegments;
  }
}
