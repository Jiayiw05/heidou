import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import dotenv from 'dotenv';
import { AudioStreamService } from './services/audioStreamService';
import { TTSService } from './services/ttsService';
import { AudioPlayerService } from './services/audioPlayerService';
import { AIConversationService } from './services/aiConversationService';
import { createClient } from 'redis';
import { memoryStore } from './services/memoryStore';

dotenv.config();

// 如果前端 build 目录存在，自动开启生产模式（托管静态文件）
const isProduction = process.env.NODE_ENV === 'production'
  || require('fs').existsSync(require('path').join(__dirname, '../../frontend/build/index.html'));

// Redis / 内存存储（Redis 不可用时自动切换，适配云部署）
async function connectStore() {
  try {
    const client = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      socket: { connectTimeout: 3000, reconnectStrategy: false }
    });
    await client.connect();
    await client.ping();
    console.log('Redis 已连接');
    return client;
  } catch {
    console.log('Redis 不可用，使用内存存储');
    memoryStore.scheduleCleanup(30);
    return memoryStore;
  }
}

// 存储实例
let redis: any;

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: isProduction ? true : (process.env.FRONTEND_URL || "http://localhost:3000"),
    methods: ["GET", "POST"]
  }
});

// 中间件
app.use(cors({
  origin: isProduction ? true : (process.env.FRONTEND_URL || "http://localhost:3000"),
}));
app.use(express.json());

// 生产环境：提供前端静态文件
if (isProduction) {
  const frontendBuild = path.join(__dirname, '../../frontend/build');
  app.use(express.static(frontendBuild));
  // SPA 路由 fallback
  app.get('*', (req, res, next) => {
    // API 路由和 Socket.io 不 fallback
    if (req.path.startsWith('/health') || req.path.startsWith('/socket.io')) {
      return next();
    }
    res.sendFile(path.join(frontendBuild, 'index.html'));
  });
}

// 基础路由
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Meeting Assistant Backend is running' });
});

// 存储每个会话的音频流服务
const sessionStreams = new Map<string, AudioStreamService>();

// 存储每个会话的音频播放器
const sessionPlayers = new Map<string, AudioPlayerService>();

// 创建全局TTS服务实例
const ttsService = new TTSService({
  voice: 'default',
  speed: 1.0
});

// 预加载TTS模型
ttsService.preloadModel().catch(console.error);

// 创建AI对话服务实例
let aiService: AIConversationService | null = null;

// 初始化AI服务
async function initializeAIService() {
  if (process.env.OPENAI_API_KEY) {
    const baseURL = process.env.OPENAI_BASE_URL || process.env.AI_API_URL;
    aiService = new AIConversationService(
      process.env.OPENAI_API_KEY,
      redis,
      baseURL
    );

    const isAvailable = await aiService.isServiceAvailable();
    if (isAvailable) {
      console.log('AI对话服务已初始化');
      if (baseURL && baseURL.includes('openrouter.ai')) {
        console.log('使用OpenRouter API:', baseURL);
      }
    } else {
      console.log('AI对话服务初始化失败，使用模拟模式');
    }
  } else {
    console.log('未配置API密钥，AI功能将使用模拟模式');
  }
}

// Socket.IO 连接处理
io.on('connection', (socket) => {
  console.log('用户已连接:', socket.id);

  // 加入会议室
  socket.on('join-room', (roomId: string) => {
    socket.join(roomId);
    console.log(`用户 ${socket.id} 加入房间 ${roomId}`);

    // 创建音频流服务
    const streamService = new AudioStreamService();
    sessionStreams.set(socket.id, streamService);

    // 创建音频播放器
    const playerService = new AudioPlayerService(ttsService);
    sessionPlayers.set(socket.id, playerService);

    // 监听音频流事件
    streamService.on('speech-start', (data) => {
      socket.emit('speech-start', data);
      io.to(roomId).emit('user-speaking', { userId: socket.id });
    });

    streamService.on('speech-end', (data) => {
      socket.emit('speech-end', data);
    });

    streamService.on('text', async (data) => {
      // 发送识别的文本
      socket.emit('transcription', data);

      // 存储到Redis
      await redis.lPush(
        `session:${socket.id}:messages`,
        JSON.stringify({
          type: 'user',
          text: data.text,
          timestamp: Date.now()
        })
      );

      // 保持最近100条消息
      await redis.lTrim(`session:${socket.id}:messages`, 0, 99);
    });

    streamService.on('wake-word', async (data) => {
      // 检测到唤醒词
      console.log('检测到唤醒词:', data);
      socket.emit('wake-word-detected', data);
      io.to(roomId).emit('assistant-activated', { userId: socket.id });

      // 生成AI回应
      if (aiService) {
        try {
          // 获取最近的上下文
          const messages = await redis.lRange(`session:${socket.id}:messages`, 0, 9);
          const context = messages.map((msg: string) => {
            const parsed = JSON.parse(msg);
            return parsed.type === 'user' ? `用户: ${parsed.text}` : `助手: ${parsed.text}`;
          }).join('\n');

          // 生成欢迎回应
          const response = await aiService.generateResponse(
            socket.id,
            data.text || '用户唤醒了我',
            {
              maxTokens: 100,
              temperature: 0.7
            }
          );

          // 发送AI回应
          socket.emit('ai-response', {
            text: response,
            type: 'wake-word-response'
          });

          // 自动播放语音
          socket.emit('speak-text', {
            text: response,
            interrupt: true,
            priority: 1
          });

        } catch (error) {
          console.error('生成AI回应失败:', error);
          socket.emit('error', { message: 'AI回应失败' });
        }
      }
    });

    // 监听播放器事件
    playerService.on('synthesis-start', (data) => {
      socket.emit('tts-start', data);
      io.to(roomId).emit('assistant-thinking', { userId: socket.id });
    });

    playerService.on('synthesis-complete', (data) => {
      socket.emit('tts-complete', data);
    });

    playerService.on('playback-start', (data) => {
      socket.emit('audio-start', data);
      io.to(roomId).emit('assistant-speaking', { userId: socket.id });
    });

    playerService.on('playback-complete', (data) => {
      socket.emit('audio-complete', data);
      io.to(roomId).emit('assistant-idle', { userId: socket.id });
    });

    playerService.on('progress', (data) => {
      // 发送可视化数据
      const vizData = playerService.getVisualizationData();
      socket.emit('audio-visualization', vizData);
      socket.emit('audio-progress', data);
    });

    playerService.on('interrupted', () => {
      socket.emit('audio-interrupted');
      io.to(roomId).emit('assistant-idle', { userId: socket.id });
    });

    socket.to(roomId).emit('user-joined', { userId: socket.id });
  });

  // 处理语音数据
  let voiceChunkCount = 0;
  socket.on('voice-data', async (data) => {
    const streamService = sessionStreams.get(socket.id);
    if (streamService && data.audio) {
      try {
        // 将base64音频转换为Buffer
        const audioBuffer = Buffer.from(data.audio, 'base64');

        // 诊断日志：每10个chunk输出一次
        voiceChunkCount++;
        if (voiceChunkCount % 10 === 0) {
          const isWav = audioBuffer[0] === 0x52 && audioBuffer[1] === 0x49 &&
                        audioBuffer[2] === 0x46 && audioBuffer[3] === 0x46;
          console.log(
            `[语音诊断 #${voiceChunkCount}] 大小=${audioBuffer.length}字节 ` +
            `RIFF头=${isWav ? '✓有效WAV' : '✗不是WAV'} ` +
            `前8字节=${audioBuffer.slice(0, 8).toString('hex')}`
          );
        }

        await streamService.processAudioChunk(audioBuffer);
      } catch (error) {
        console.error('处理语音数据失败:', error);
        socket.emit('error', { message: '语音处理失败' });
      }
    } else if (!streamService) {
      console.log('[语音诊断] 收到音频但 streamService 未初始化（还未 join-room）');
    } else {
      console.log('[语音诊断] 收到空音频数据');
    }
  });

  // 浏览器语音识别结果（替代后端 Whisper ASR）
  socket.on('voice-text', async (data: { text: string }) => {
    const text = data.text?.trim();
    if (!text) return;

    console.log(`[浏览器ASR] 识别结果: "${text}"`);

    // 存储到Redis
    await redis.lPush(
      `session:${socket.id}:messages`,
      JSON.stringify({
        type: 'user',
        text,
        timestamp: Date.now()
      })
    );
    await redis.lTrim(`session:${socket.id}:messages`, 0, 99);

    // 发送转录到前端显示
    socket.emit('transcription', { text, confidence: 1, is_final: true });

    // 唤醒词检测（精确匹配 + 模糊匹配常见同音词）
    const wakeWords = ['小五', '小5', '小屋', '小吾', '小无', '小午', '小舞', '小武'];
    const hasWakeWord = wakeWords.some(w => text.includes(w));

    if (hasWakeWord) {
      console.log(`[浏览器ASR] 🔔 检测到唤醒词: "${text}"`);
      socket.emit('wake-word-detected', { text });

      if (aiService) {
        try {
          console.log('[唤醒词] 开始调用 DeepSeek...');
          socket.emit('ai-thinking', { message: text });

          const response = await aiService.generateResponse(
            socket.id,
            text,
            { maxTokens: 150, temperature: 0.7 }
          );

          console.log(`[唤醒词] DeepSeek 回复: "${response?.slice(0, 80)}"`);
          socket.emit('ai-response', { text: response, type: 'wake-word-response' });
          socket.emit('speak-text', { text: response, interrupt: true, priority: 1 });
        } catch (error) {
          console.error('[唤醒词] AI回应失败:', error);
          socket.emit('error', { message: 'AI回应失败' });
        }
      } else {
        console.log('[唤醒词] aiService 为 null，跳过AI回复');
      }
    }
  });

  // 处理文本消息
  socket.on('text-message', async (data) => {
    console.log('收到文本消息:', data);

    // 存储到Redis
    await redis.lPush(
      `session:${socket.id}:messages`,
      JSON.stringify({
        type: 'user',
        text: data.text,
        timestamp: Date.now()
      })
    );

    // 保持最近100条消息
    await redis.lTrim(`session:${socket.id}:messages`, 0, 99);
  });

  // AI回复语音合成
  socket.on('speak-text', async (data) => {
    const playerService = sessionPlayers.get(socket.id);
    if (!playerService) {
      socket.emit('error', { message: '音频播放器未初始化' });
      return;
    }

    try {
      // 存储AI回复到Redis
      await redis.lPush(
        `session:${socket.id}:messages`,
        JSON.stringify({
          type: 'assistant',
          text: data.text,
          timestamp: Date.now()
        })
      );

      // 保持最近100条消息
      await redis.lTrim(`session:${socket.id}:messages`, 0, 99);

      // 合成并播放语音
      await playerService.speak(data.text, {
        interrupt: data.interrupt || false,
        priority: data.priority || 0
      });

    } catch (error) {
      console.error('语音合成失败:', error);
      socket.emit('error', { message: '语音合成失败' });
    }
  });

  // 中断当前播放
  socket.on('interrupt-audio', () => {
    const playerService = sessionPlayers.get(socket.id);
    if (playerService) {
      playerService.interrupt();
    }
  });

  // 暂停/恢复播放
  socket.on('toggle-audio', () => {
    const playerService = sessionPlayers.get(socket.id);
    if (playerService) {
      const state = playerService.getState();
      if (state.isPlaying) {
        playerService.pause();
      } else if (state.isPaused) {
        playerService.resume();
      }
    }
  });

  // 设置音量
  socket.on('set-volume', (volume: number) => {
    const playerService = sessionPlayers.get(socket.id);
    if (playerService) {
      playerService.setVolume(volume);
    }
  });

  // 获取播放状态
  socket.on('get-audio-status', () => {
    const playerService = sessionPlayers.get(socket.id);
    if (playerService) {
      const state = playerService.getState();
      const queueStatus = playerService.getQueueStatus();
      socket.emit('audio-status', { state, queueStatus });
    }
  });

  // 处理状态变化
  socket.on('status-change', (status) => {
    // 广播状态变化
    socket.broadcast.emit('status-updated', { userId: socket.id, status });
  });

  // AI对话请求
  socket.on('ai-chat', async (data) => {
    console.log(`[AI-Chat] 收到文字请求: "${data.message?.slice(0, 50)}"`);

    if (!aiService) {
      console.log('[AI-Chat] AI服务未初始化');
      socket.emit('error', { message: 'AI服务未可用' });
      return;
    }

    try {
      const { message, options } = data;

      socket.emit('ai-thinking', { message });
      console.log('[AI-Chat] 已发送 ai-thinking，开始调用 DeepSeek...');

      const response = await aiService.generateResponse(socket.id, message, options);

      console.log(`[AI-Chat] DeepSeek 回复: "${response?.slice(0, 80)}"`);

      socket.emit('ai-response', {
        text: response,
        type: 'chat-response'
      });

      // TTS 播报（非阻塞，失败不影响回复显示）
      if (data.speak !== false) {
        console.log('[AI-Chat] 触发 TTS 播报...');
        socket.emit('speak-text', {
          text: response,
          interrupt: data.interrupt || false,
          priority: data.priority || 0
        });
      }
    } catch (error) {
      console.error('[AI-Chat] 失败:', (error as Error).message);
      socket.emit('error', { message: 'AI对话失败: ' + (error as Error).message });
    }
  });

  // 流式AI对话
  socket.on('ai-chat-stream', async (data) => {
    if (!aiService) {
      socket.emit('error', { message: 'AI服务未可用' });
      return;
    }

    try {
      const { message, options } = data;
      let fullResponse = '';

      socket.emit('ai-thinking', { message });

      // 流式生成
      for await (const chunk of aiService.generateStreamResponse(socket.id, message, options)) {
        fullResponse += chunk;
        socket.emit('ai-chunk', { chunk, fullResponse });
      }

      // 流式结束
      socket.emit('ai-stream-complete', { text: fullResponse });

      // 自动播放完整回复
      if (data.speak !== false) {
        socket.emit('speak-text', {
          text: fullResponse,
          interrupt: data.interrupt || false,
          priority: data.priority || 0
        });
      }

    } catch (error) {
      console.error('AI流式对话失败:', error);
      socket.emit('error', { message: 'AI流式对话失败' });
    }
  });

  // 会议分析
  socket.on('analyze-meeting', async () => {
    if (!aiService) {
      socket.emit('error', { message: 'AI服务未可用' });
      return;
    }

    try {
      socket.emit('analysis-start');
      const analysis = await aiService.analyzeMeeting(socket.id);
      socket.emit('analysis-result', analysis);
    } catch (error) {
      console.error('会议分析失败:', error);
      socket.emit('error', { message: '会议分析失败' });
    }
  });

  // 清除AI对话历史
  socket.on('clear-ai-conversation', async () => {
    if (aiService) {
      try {
        await aiService.clearConversation(socket.id);
        socket.emit('ai-conversation-cleared');
      } catch (error) {
        console.error('清除AI对话历史失败:', error);
      }
    }
  });

  // 设置自定义AI提示
  socket.on('set-ai-prompt', async (prompt: string) => {
    if (aiService) {
      try {
        await aiService.setCustomPrompt(socket.id, prompt);
        socket.emit('ai-prompt-set');
      } catch (error) {
        console.error('设置AI提示失败:', error);
        socket.emit('error', { message: '设置AI提示失败' });
      }
    }
  });

  // 获取会话历史
  socket.on('get-history', async () => {
    try {
      const messages = await redis.lRange(`session:${socket.id}:messages`, 0, -1);
      const history = messages.reverse().map((msg: string) => JSON.parse(msg));
      socket.emit('history', history);
    } catch (error) {
      console.error('获取历史记录失败:', error);
      socket.emit('history', []);
    }
  });

  // 清除历史
  socket.on('clear-history', async () => {
    try {
      await redis.del(`session:${socket.id}:messages`);
      socket.emit('history-cleared');
    } catch (error) {
      console.error('清除历史记录失败:', error);
    }
  });

  // 断开连接
  socket.on('disconnect', async () => {
    console.log('用户已断开连接:', socket.id);

    // 停止音频流服务
    const streamService = sessionStreams.get(socket.id);
    if (streamService) {
      streamService.stop();
      sessionStreams.delete(socket.id);
    }

    // 停止音频播放器
    const playerService = sessionPlayers.get(socket.id);
    if (playerService) {
      playerService.cleanup();
      sessionPlayers.delete(socket.id);
    }

    // 清理会话数据（可选，根据需求决定是否立即清理）
    // await redis.del(`session:${socket.id}:messages`);
  });
});

// 异步启动：连存储 → 初始化AI → 监听端口
async function start() {
  redis = await connectStore();
  await initializeAIService();

  const PORT = process.env.PORT || 3001;
  server.listen(PORT, () => {
    console.log(`服务器运行在端口 ${PORT}`);
    console.log(isProduction ? '生产模式：已托管前端页面' : '开发模式：前端请单独启动');
  });
}

start();