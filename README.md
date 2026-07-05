# 会议小参谋 v3.0

一个基于 AI 的实时会议语音助手，专注语音识别、智能对话和会议分析。

## 功能特性

### 🎤 核心功能
- **实时语音识别** - 基于浏览器 SpeechRecognition API，实时转写中文语音
- **自然语音播报** - 基于浏览器 SpeechSynthesis API，AI 回复自动朗读
- **关键词唤醒** - 说"小五"、"小5"、"小屋"等唤醒助手（支持同音词容错）
- **文字输入** - 随时输入文字与 AI 对话，无需启动麦克风
- **流式输出** - AI 回复逐字显示，边想边看

### 🎨 界面设计
- **沉浸式深色主题** - 纯黑背景，减少会议干扰
- **动态波纹效果** - 实时音频可视化
- **四级状态显示** - 待机 / 监听 / 思考 / 播报
- **双态主控按钮** - "一起聊聊" / "下次再会"

### 🤖 AI 功能
- **智能对话** - 基于 DeepSeek 的上下文理解
- **会议分析** - 一键提取关键要点、决策和行动项
- **流式输出** - 实时显示 AI 思考过程
- **记录导出** - 会议记录支持导出 TXT 文件
- **上下文管理** - 保持最近 100 条消息历史

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 18 + TypeScript + Tailwind CSS |
| 语音识别 | 浏览器 SpeechRecognition API（Chrome / Edge） |
| 语音合成 | 浏览器 SpeechSynthesis API |
| 实时通信 | Socket.io |
| AI 模型 | DeepSeek（deepseek-chat） |
| 存储 | Redis（可选，无 Redis 时自动切内存存储） |
| 部署 | Render 云平台 |

## 快速开始

### 环境要求
- Node.js 18+
- 浏览器：Chrome 或 Edge（语音功能需 HTTPS 或 localhost）

### 本地开发

```bash
# 1. 安装依赖
cd backend && npm install
cd ../frontend && npm install

# 2. 配置环境变量
cp backend/.env.example backend/.env
# 编辑 backend/.env，设置 DeepSeek API 密钥
# OPENAI_API_KEY=sk-你的密钥
# OPENAI_BASE_URL=https://api.deepseek.com/v1
# AI_MODEL=deepseek-chat

# 3. 启动（需要两个终端）
# 终端 1：后端
cd backend && npm run dev

# 终端 2：前端
cd frontend && npm start
```

### 访问
- 前端：http://localhost:3000
- 后端：http://localhost:3001

### 一键生产模式

```bash
# 构建前端
cd frontend && npm run build

# 启动（后端自动托管前端页面）
cd ../backend && npm start
# 打开 http://localhost:3001 即可使用
```

## 使用说明

### 基本操作

1. **文字对话**：底部输入框直接打字，按 Enter 发送
2. **语音对话**：点击"一起聊聊" → 允许麦克风 → 说"小五"唤醒 AI
3. **会议分析**：对话后点击右下角"分析"按钮，AI 自动总结
4. **导出记录**：点击"导出"按钮下载 TXT 文件；悬停 AI 消息可单条导出
5. **结束会议**：点击"下次再会"，数据自动清理

## 部署

### Render 部署（免费）

1. Fork 本仓库到 GitHub
2. 在 [Render](https://dashboard.render.com) 创建 Web Service
3. 配置：Build `npm install --prefix backend && npm install --prefix frontend && npm run build --prefix frontend`，Start `npm start --prefix backend`
4. 添加环境变量：`OPENAI_API_KEY`、`OPENAI_BASE_URL`、`AI_MODEL`
5. 部署完成后生成 `https://xxx.onrender.com` 地址

### 局域网部署

双击 `start.bat`，终端显示局域网地址，同网络设备浏览器打开即可。

> 注意：Chrome 在 HTTP 地址下限制麦克风，建议局域网使用 Edge 浏览器。

## 架构说明

```
浏览器                                       后端（Node.js）
┌──────────────────────┐         ┌──────────────────────┐
│ SpeechRecognition    │  文字   │                      │
│ (语音转文字)         │──WebSocket→│ 唤醒词检测           │
│                      │         │     ↓                │
│ SpeechSynthesis      │  音频   │ DeepSeek AI          │
│ (文字转语音)         │←WebSocket─│     ↓               │
│                      │         │ TTS 音频 / 文字回复   │
└──────────────────────┘         └──────────────────────┘
```

## 项目结构

```
会议小参谋/
├── frontend/                    # React 前端
│   └── src/
│       ├── components/          # UI 组件
│       │   ├── MessageInput.tsx   # 文字输入框
│       │   ├── MessageBubble.tsx  # 消息气泡（支持导出）
│       │   ├── ControlPanel.tsx   # 底部控制栏
│       │   └── ...
│       ├── contexts/            # React 上下文
│       │   ├── MeetingContext.tsx # 会议状态管理
│       │   └── SocketContext.tsx  # WebSocket 连接
│       ├── hooks/               # 自定义 Hooks
│       │   ├── useSpeechRecognition.ts  # 语音识别
│       │   ├── useSpeechSynthesis.ts    # 语音合成
│       │   └── useAudioRecorder.ts      # 音频录制
│       └── utils/
│           └── exportMeeting.ts # 会议记录导出
├── backend/                     # Node.js 后端
│   └── src/
│       ├── index.ts             # 主入口
│       ├── services/
│       │   ├── aiConversationService.ts # AI 对话服务
│       │   ├── ttsService.ts           # TTS 服务
│       │   ├── memoryStore.ts         # 内存存储
│       │   └── ...
│       └── utils/
│           └── pythonBridge.ts  # Python 调用桥接
├── start.bat                    # 一键启动脚本
└── render.yaml                  # Render 部署配置
```

## 故障排除

| 问题 | 解决 |
|------|------|
| 麦克风权限被拒绝 | 使用 HTTPS 或 localhost；局域网用 Edge |
| AI 不回应 | 检查 `OPENAI_API_KEY` 和 `OPENAI_BASE_URL` 是否正确 |
| AI 答非所问 | 确认 `AI_MODEL` 为 `deepseek-chat` |
| 连接失败 | 确认端口 3001 未被占用 |
| 语音识别不可用 | 必须使用 Chrome 或 Edge 浏览器 |

## 许可证

MIT License
