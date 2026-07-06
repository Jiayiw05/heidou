import { Message } from '../contexts/MeetingContext';
import { isEmbedded, sendToParent } from './postMessage';

/**
 * 构建会议记录文本内容
 */
export function buildMeetingContent(messages: Message[]): string {
  const now = new Date();
  const dateStr = now.toLocaleDateString('zh-CN');
  const timeStr = now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });

  const lines: string[] = [
    '═══════════════════════════════════',
    '  会议小参谋 - 会议记录',
    `  日期: ${dateStr} ${timeStr}`,
    `  共 ${messages.length} 条记录`,
    '═══════════════════════════════════',
    '',
  ];

  for (const msg of messages) {
    const timestamp = new Date(msg.timestamp).toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

    switch (msg.type) {
      case 'user':
        lines.push(`[${timestamp}] 🎤 发言:`);
        lines.push(`${msg.text}`);
        break;
      case 'assistant':
        lines.push(`[${timestamp}] 🤖 小五:`);
        lines.push(`${msg.text}`);
        break;
      case 'system':
        lines.push(`[${timestamp}] ⚙ ${msg.text}`);
        break;
    }
    lines.push('');
  }

  lines.push('═══════════════════════════════════');
  lines.push('  由 会议小参谋 v3.0 生成');
  lines.push('═══════════════════════════════════');

  return lines.join('\n');
}

/**
 * 构建文件名（不含 .txt 后缀）
 */
export function buildMeetingFilename(): string {
  const dateStr = new Date().toLocaleDateString('zh-CN').replace(/\//g, '-');
  return `会议记录_${dateStr}.txt`;
}

/**
 * 触发浏览器下载
 */
function triggerDownload(content: string, filename: string): void {
  const blob = new Blob(['﻿' + content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * 导出会议记录
 *
 * - 嵌入 iframe 模式（window.parent !== window）：通过 postMessage 发送给父页面
 * - 独立模式：触发浏览器下载
 */
export function exportMeeting(messages: Message[], filename?: string): void {
  if (messages.length === 0) return;

  const content = buildMeetingContent(messages);
  const name = filename || buildMeetingFilename();

  if (isEmbedded()) {
    // 嵌入模式：发送给父页面
    sendToParent({
      source: 'meeting-assistant',
      version: '1.0',
      type: 'MEETING_EXPORT',
      timestamp: Date.now(),
      data: {
        content,
        filename: name,
        messageCount: messages.length,
      },
    });
  } else {
    // 独立模式：浏览器下载
    triggerDownload(content, name);
  }
}
