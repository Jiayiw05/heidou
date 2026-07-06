/**
 * 会议小参谋 — 与父页面 postMessage 通信协议
 *
 * 约定消息格式：父页面监听 window.message 事件，
 * 根据 event.data.source === 'meeting-assistant' 识别来源。
 *
 * 父页面示例：
 *   window.addEventListener('message', (event) => {
 *     if (event.data.source !== 'meeting-assistant') return;
 *     // 处理 event.data
 *   });
 */

// ─── 类型定义 ────────────────────────────────────────────────

/** 消息类型 */
export type PostMessageType =
  | 'MEETING_EXPORT'        // 导出全部会议记录（.txt 内容）
  | 'SINGLE_MESSAGE_EXPORT' // 导出单条 AI 回复
  | 'READY'                 // iframe 加载完成通知
  | 'ERROR';                // 错误信息

/** 发送给父页面的消息体 */
export interface PostMessagePayload {
  /** 固定标识，父页面用于校验来源 */
  source: 'meeting-assistant';
  /** 协议版本，便于父页面做兼容 */
  version: '1.0';
  /** 消息类型 */
  type: PostMessageType;
  /** 发送时间戳 (ms) */
  timestamp: number;
  /** 数据载荷 */
  data: {
    /** 文件文本内容（type=MEETING_EXPORT / SINGLE_MESSAGE_EXPORT 时） */
    content?: string;
    /** 建议的文件名 */
    filename?: string;
    /** 单条导出时的消息 ID */
    messageId?: string;
    /** 全部导出时的消息条数 */
    messageCount?: number;
    /** 错误描述（type=ERROR 时） */
    error?: string;
  };
}

// ─── 工具函数 ────────────────────────────────────────────────

/** 检测当前页面是否嵌入在 iframe 中 */
export function isEmbedded(): boolean {
  try {
    return window.parent !== window;
  } catch {
    // 跨域时访问 window.parent 可能抛异常，视为非嵌入
    return false;
  }
}

/** 向父页面发送消息（非嵌入模式静默跳过） */
export function sendToParent(payload: PostMessagePayload): void {
  if (!isEmbedded()) return;

  try {
    window.parent.postMessage(payload, '*');
  } catch (err) {
    console.warn('[会议小参谋] postMessage 发送失败:', err);
  }
}

/** 通知父页面 iframe 已就绪 */
export function notifyReady(): void {
  sendToParent({
    source: 'meeting-assistant',
    version: '1.0',
    type: 'READY',
    timestamp: Date.now(),
    data: {},
  });
}

/** 发送错误通知 */
export function notifyError(error: string): void {
  sendToParent({
    source: 'meeting-assistant',
    version: '1.0',
    type: 'ERROR',
    timestamp: Date.now(),
    data: { error },
  });
}
