import OpenAI from 'openai';
import { createClient } from 'redis';

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

export interface ConversationOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  presencePenalty?: number;
  frequencyPenalty?: number;
}

export class AIConversationService {
  private openai: OpenAI;
  private redis: ReturnType<typeof createClient>;
  private defaultOptions: ConversationOptions;

  constructor(apiKey: string, redis: ReturnType<typeof createClient>, baseURL?: string) {
    const config: any = {
      apiKey: apiKey,
    };

    // 对所有自定义 baseURL 都进行配置（不只是 OpenRouter）
    if (baseURL) {
      config.baseURL = baseURL;
      console.log('AI 服务使用自定义 API 端点:', baseURL);

      // OpenRouter 需要额外的 headers
      if (baseURL.includes('openrouter.ai')) {
        config.defaultHeaders = {
          'HTTP-Referer': process.env.FRONTEND_URL || 'http://localhost:3000',
          'X-Title': '会议小参谋 v3.0',
        };
      }
    }

    this.openai = new OpenAI(config);
    this.redis = redis;
    this.defaultOptions = {
      // 从环境变量读取模型名，否则根据 baseURL 推断默认值
      model: process.env.AI_MODEL || this.inferDefaultModel(baseURL),
      maxTokens: 1000,
      temperature: 0.7,
      topP: 0.9,
      presencePenalty: 0.6,
      frequencyPenalty: 0.6,
    };
  }

  /**
   * 根据 baseURL 推断默认模型名
   */
  private inferDefaultModel(baseURL?: string): string {
    if (!baseURL) return 'gpt-3.5-turbo';
    if (baseURL.includes('deepseek')) return 'deepseek-chat';
    if (baseURL.includes('openrouter')) return 'openai/gpt-3.5-turbo';
    return 'gpt-3.5-turbo';
  }

  /**
   * 生成AI回复
   */
  async generateResponse(
    sessionId: string,
    userMessage: string,
    options?: ConversationOptions
  ): Promise<string> {
    const opts = { ...this.defaultOptions, ...options };

    try {
      const messages = await this.getConversationHistory(sessionId);
      const conversationMessages = this.buildConversationMessages(messages, userMessage);

      const completion = await this.openai.chat.completions.create({
        model: opts.model!,
        messages: conversationMessages,
        max_tokens: opts.maxTokens,
        temperature: opts.temperature,
        top_p: opts.topP,
        presence_penalty: opts.presencePenalty,
        frequency_penalty: opts.frequencyPenalty,
        stream: false,
      });

      const aiResponse = completion.choices[0]?.message?.content || '';

      await this.saveMessage(sessionId, {
        role: 'user',
        content: userMessage,
        timestamp: Date.now(),
      });

      await this.saveMessage(sessionId, {
        role: 'assistant',
        content: aiResponse,
        timestamp: Date.now(),
      });

      return aiResponse;
    } catch (error) {
      console.error('AI对话生成失败:', error);
      return this.generateMockResponse(userMessage);
    }
  }

  /**
   * 流式生成回复
   */
  async *generateStreamResponse(
    sessionId: string,
    userMessage: string,
    options?: ConversationOptions
  ): AsyncGenerator<string> {
    const opts = { ...this.defaultOptions, ...options };

    try {
      const messages = await this.getConversationHistory(sessionId);
      const conversationMessages = this.buildConversationMessages(messages, userMessage);

      await this.saveMessage(sessionId, {
        role: 'user',
        content: userMessage,
        timestamp: Date.now(),
      });

      const stream = await this.openai.chat.completions.create({
        model: opts.model!,
        messages: conversationMessages,
        max_tokens: opts.maxTokens,
        temperature: opts.temperature,
        stream: true,
      });

      let fullResponse = '';

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        if (content) {
          fullResponse += content;
          yield content;
        }
      }

      await this.saveMessage(sessionId, {
        role: 'assistant',
        content: fullResponse,
        timestamp: Date.now(),
      });

    } catch (error) {
      console.error('AI流式对话生成失败:', error);
      const mockResponse = this.generateMockResponse(userMessage);
      yield mockResponse;

      await this.saveMessage(sessionId, {
        role: 'assistant',
        content: mockResponse,
        timestamp: Date.now(),
      });
    }
  }

  /**
   * 获取会话历史
   */
  async getConversationHistory(sessionId: string): Promise<Message[]> {
    try {
      const messages = await this.redis.lRange(
        `session:${sessionId}:conversation`,
        0,
        -1
      );

      return messages
        .map(msg => JSON.parse(msg))
        .reverse();
    } catch (error) {
      console.error('获取会话历史失败:', error);
      return [];
    }
  }

  /**
   * 构建对话消息数组
   */
  private buildConversationMessages(history: Message[], currentMessage: string): OpenAI.Chat.ChatCompletionMessageParam[] {
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      {
        role: 'system',
        content: this.getSystemPrompt(),
      },
    ];

    const recentHistory = history.slice(-20);
    for (const msg of recentHistory) {
      messages.push({
        role: msg.role,
        content: msg.content,
      });
    }

    messages.push({
      role: 'user',
      content: currentMessage,
    });

    return messages;
  }

  /**
   * 获取系统提示词
   */
  private getSystemPrompt(): string {
    return `你是"小五"，一个专业的会议助手。请遵循以下规则：

1. 语气友好、专业，使用简洁明了的中文回复
2. 对于会议中的讨论，提供有价值的分析和建议
3. 当需要总结时，提炼关键要点和决策
4. 保持回复简洁，一般在200字以内
5. 如果不确定信息，坦诚说明不要猜测
6. 积极参与讨论，但避免主导会议

记住：你是来辅助会议的，不是会议的主角。`;
  }

  /**
   * 保存消息到Redis
   */
  private async saveMessage(sessionId: string, message: Message): Promise<void> {
    await this.redis.lPush(
      `session:${sessionId}:conversation`,
      JSON.stringify(message)
    );

    await this.redis.lTrim(`session:${sessionId}:conversation`, 0, 99);
  }

  /**
   * 生成模拟回复（降级方案）
   */
  private generateMockResponse(userMessage: string): string {
    const responses = [
      "这是一个很好的观点，我们可以进一步讨论。",
      "根据您提到的内容，我建议我们可以考虑以下几点...",
      "让我总结一下刚才的要点...",
      "这个想法很有创意，也许我们可以这样实现...",
      "从会议记录来看，我们已经讨论了以下几个主题...",
      "关于这个问题，我有一些补充建议...",
    ];

    if (userMessage.includes('总结') || userMessage.includes('回顾')) {
      return "根据刚才的讨论，主要涉及了以下几点：1. 项目进展情况；2. 遇到的挑战；3. 下一步计划。建议我们重点关注第三点。";
    }

    if (userMessage.includes('建议') || userMessage.includes('意见')) {
      return "感谢您的建议。这确实是一个值得考虑的方向。我们可以进一步探讨实施的可能性。";
    }

    if (userMessage.includes('问题') || userMessage.includes('困难')) {
      return "针对您提到的问题，我建议可以从以下几个角度来考虑：1. 分析根本原因；2. 寻找现有资源；3. 制定解决方案。";
    }

    return responses[Math.floor(Math.random() * responses.length)];
  }

  /**
   * 清理会话历史
   */
  async clearConversation(sessionId: string): Promise<void> {
    try {
      await this.redis.del(`session:${sessionId}:conversation`);
    } catch (error) {
      console.error('清理对话历史失败:', error);
    }
  }

  /**
   * 设置自定义提示词
   */
  async setCustomPrompt(sessionId: string, prompt: string): Promise<void> {
    try {
      await this.redis.set(`session:${sessionId}:custom_prompt`, prompt);
    } catch (error) {
      console.error('设置自定义提示词失败:', error);
    }
  }

  /**
   * 获取自定义提示词
   */
  async getCustomPrompt(sessionId: string): Promise<string | null> {
    try {
      return await this.redis.get(`session:${sessionId}:custom_prompt`);
    } catch (error) {
      console.error('获取自定义提示词失败:', error);
      return null;
    }
  }

  /**
   * 分析会议内容
   */
  async analyzeMeeting(sessionId: string): Promise<{
    summary: string;
    keyPoints: string[];
    decisions: string[];
    actionItems: string[];
  }> {
    try {
      // 同时读取语音转录记录和 AI 对话记录
      const messagesKey = `session:${sessionId}:messages`;
      const voiceMessages = await this.redis.lRange(messagesKey, 0, -1);
      const chatMessages = await this.getConversationHistory(sessionId);

      console.log(`[会议分析] sessionId=${sessionId}`);
      console.log(`[会议分析] 语音记录 key=${messagesKey}, 条数=${voiceMessages.length}`);
      console.log(`[会议分析] AI对话记录 条数=${chatMessages.length}`);

      // 语音转录：{ type, text, timestamp }
      const voiceTexts = voiceMessages
        .map((msg: string) => {
          try {
            const parsed = JSON.parse(msg);
            return parsed.type === 'user' ? parsed.text : null;
          } catch { return null; }
        })
        .filter(Boolean)
        .reverse(); // 按时间正序

      // AI 对话：{ role, content, timestamp }
      const chatTexts = chatMessages
        .filter(m => m.role !== 'system')
        .map(m => `[${m.role === 'user' ? '提问' : '回复'}]: ${m.content}`);

      const allContent = [
        ...(voiceTexts.length > 0 ? ['=== 会议语音记录 ===', ...voiceTexts] : []),
        ...(chatTexts.length > 0 ? ['=== 互动问答记录 ===', ...chatTexts] : []),
      ].join('\n');

      console.log(`[会议分析] 合并后总文本长度=${allContent.length}字符`);
      console.log(`[会议分析] 文本预览: ${allContent.slice(0, 200)}...`);

      if (!allContent.trim()) {
        console.log('[会议分析] 无内容可分析');
        return {
          summary: '暂无会议内容，请先进行语音录入或对话',
          keyPoints: [],
          decisions: [],
          actionItems: [],
        };
      }

      const prompt = `你是会议纪要专家。请分析以下会议内容，提取有价值的信息。

注意：语音记录是会议的实际发言内容，互动问答是助手与参会者的对话。请以语音记录中的实际会议内容为主要分析对象。

会议内容：
${allContent}

请按以下格式回复：
总结：[会议讨论的核心内容，2-3句话概括]
关键要点：[要点1, 要点2, 要点3，逗号分隔]
决策：[决策1, 决策2，逗号分隔]
行动项：[任务1, 任务2，逗号分隔]`;

      const response = await this.generateResponse(sessionId, prompt, {
        maxTokens: 800,
        temperature: 0.3,
      });

      const summary = response.match(/总结：([\s\S]*?)(?=关键要点：|$)/)?.[1]?.trim() || '';
      const keyPointsMatch = response.match(/关键要点：([\s\S]*?)(?=决策：|$)/)?.[1];
      const decisionsMatch = response.match(/决策：([\s\S]*?)(?=行动项：|$)/)?.[1];
      const actionItemsMatch = response.match(/行动项：([\s\S]*)/)?.[1];

      const keyPoints = keyPointsMatch ? keyPointsMatch.split(/[,，、]/).map(p => p.trim()).filter(p => p) : [];
      const decisions = decisionsMatch ? decisionsMatch.split(/[,，、]/).map(d => d.trim()).filter(d => d) : [];
      const actionItems = actionItemsMatch ? actionItemsMatch.split(/[,，、]/).map(a => a.trim()).filter(a => a) : [];

      return {
        summary,
        keyPoints,
        decisions,
        actionItems,
      };
    } catch (error) {
      console.error('会议分析失败:', error);
      return {
        summary: '会议分析暂时不可用',
        keyPoints: [],
        decisions: [],
        actionItems: [],
      };
    }
  }

  /**
   * 检查服务是否可用
   */
  async isServiceAvailable(): Promise<boolean> {
    try {
      await this.openai.models.list();
      return true;
    } catch (error) {
      console.warn('AI 服务可用性检查失败（将使用降级模拟模式）:', (error as any)?.message);
      return false;
    }
  }
}
