import { Message } from '../contexts/MeetingContext';

/**
 * 导出会议记录为文本文件并触发浏览器下载
 */
export function exportMeeting(messages: Message[], filename?: string): void {
  if (messages.length === 0) return;

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

  const content = lines.join('\n');
  const blob = new Blob(['﻿' + content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || `会议记录_${dateStr.replace(/\//g, '-')}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
