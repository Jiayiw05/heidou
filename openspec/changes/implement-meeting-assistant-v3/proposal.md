# Change: 实现会议小参谋v3.0 - 语音交互助手

## Why
实现一个"深思熟虑"的会议语音助手，专注于准确的语音识别和自然的语音合成，为会议提供实时记录和智能建议。

## What Changes
- 实现基于Whisper的实时语音识别（STT）功能
- 实现基于ChatTTS的文本转语音（TTS）功能
- 创建双态会话管理系统（"一起聊聊"/"下次再会"）
- 实现四级状态显示（待机/监听/思考/播报）
- 创建深色主题的沉浸式界面
- 实现关键词唤醒机制（"小五"）
- 实现先文字后语音的交互模式
- 添加音频可视化效果和波纹动画

## Impact
- Affected specs: voice-interaction, ui-components, audio-processing
- Affected code: 需要实现前端界面、后端API、WebSocket实时通信、音频处理模块
- 技术栈: React + TypeScript + Whisper + ChatTTS + Socket.io + Redis