# 会议小参谋 v3.0

一个基于AI的实时会议语音助手，专注于准确的语音识别和自然的语音合成。

## 功能特性

### 🎤 核心功能
- **实时语音识别** - 基于Whisper的高精度中文语音识别
- **智能语音合成** - 使用ChatTTS生成自然流畅的语音
- **关键词唤醒** - 说"小五"、"小5"或"小屋"唤醒助手
- **先思考后表达** - 完整生成文本后再进行语音合成

### 🎨 界面设计
- **沉浸式深色主题** - 纯黑背景，减少会议干扰
- **动态波纹效果** - 实时音频可视化
- **四级状态显示** - 待机/监听/思考/播报
- **双态主控按钮** - "一起聊聊" / "下次再会"

### 🤖 AI功能
- **智能对话** - 基于GPT-3.5的上下文理解
- **会议分析** - 自动提取关键要点和决策
- **流式输出** - 实时显示AI思考过程
- **上下文管理** - 保持最近100条消息历史

## 技术栈

### 前端
- React 18 + TypeScript
- Tailwind CSS
- Socket.io Client
- Web Audio API

### 后端
- Node.js + Express
- Socket.io
- Redis（临时存储）
- OpenAI API / Whisper / ChatTTS

### 部署
- Docker + Docker Compose
- WebSocket实时通信

## 快速开始

### 环境要求
- Node.js 16+
- Redis 6+
- Python 3.8+（用于Whisper）
- OpenRouter API密钥 或 OpenAI API密钥（可选，不提供将使用模拟模式）

### 安装依赖

```bash
# 安装后端依赖
cd backend
npm install

# 安装Python依赖
pip3 install openai-whisper torch torchaudio silero-vad

# 安装前端依赖
cd ../frontend
npm install
```

### 配置环境

1. **后端配置**
```bash
# 复制并编辑配置文件
cp backend/.env.example backend/.env
# 编辑 backend/.env，设置你的 API 密钥

# 使用 OpenRouter（推荐）
OPENAI_API_KEY=sk-or-v1-你的密钥
OPENAI_BASE_URL=https://openrouter.ai/api/v1

# 或者使用 OpenAI
OPENAI_API_KEY=sk-你的密钥
OPENAI_BASE_URL=https://api.openai.com/v1
```

2. **前端配置**
```bash
# 复制配置文件
cp frontend/.env.example frontend/.env
```

### 启动服务

使用一键启动脚本：
```bash
./start.sh
```

或手动启动：

1. **启动Redis**
```bash
# macOS
brew services start redis

# Ubuntu
sudo systemctl start redis-server
```

2. **启动后端**
```bash
cd backend
npm run dev
```

3. **启动前端**
```bash
cd frontend
npm start
```

### 访问应用
- 前端：http://localhost:3000
- 后端API：http://localhost:3001

## 使用说明

### 基本操作流程

1. **开始会议**
   - 点击"一起聊聊"按钮
   - 允许浏览器访问麦克风

2. **语音交流**
   - 正常说话，系统会实时转录
   - 说"小五"唤醒AI助手
   - AI会自动回应并语音播报

3. **结束会议**
   - 点击"下次再会"按钮
   - 所有数据自动清理

### 高级功能

- **清除历史**：点击底部"清除历史"按钮
- **中断播报**：再次说"小五"或点击按钮中断
- **会议分析**：可请求AI总结会议内容

## 架构说明

```
┌─────────────────┐    ┌─────────────────┐
│   React前端     │    │   Node.js后端   │
│                 │    │                 │
│ • 用户界面      │◄──►│ • WebSocket     │
│ • 音频录制      │    │ • 语音识别      │
│ • 状态管理      │    │ • AI对话        │
│ • 实时通信      │    │ • 语音合成      │
└─────────────────┘    └─────────────────┘
                                │
                                ▼
                        ┌─────────────────┐
                        │     Redis       │
                        │ 临时数据存储    │
                        └─────────────────┘
```

## 开发指南

### 项目结构
```
会议小参谋/
├── frontend/          # React前端
│   ├── src/
│   │   ├── components/  # UI组件
│   │   ├── contexts/    # React上下文
│   │   └── hooks/       # 自定义Hooks
│   └── package.json
├── backend/           # Node.js后端
│   ├── src/
│   │   ├── services/    # 业务服务
│   │   │   ├── aiConversationService.ts  # AI对话服务
│   │   │   ├── audioStreamService.ts      # 音频流服务
│   │   │   ├── ttsService.ts              # 语音合成服务
│   │   │   ├── vadService.ts              # 语音活动检测
│   │   │   ├── whisperService.ts         # 语音识别服务
│   │   │   └── audioPlayerService.ts      # 音频播放器
│   │   └── index.ts     # 主服务
│   └── package.json
└── docker-compose.yml  # 容器编排
```

### 添加新功能
1. 在相应的服务目录添加新模块
2. 更新Socket事件处理
3. 添加对应的UI组件
4. 更新OpenSpec文档

## 故障排除

### 常见问题

1. **麦克风权限被拒绝**
   - 确保使用HTTPS或localhost
   - 检查浏览器权限设置

2. **语音识别不工作**
   - 检查后端Python环境
   - 确认Whisper模型已下载

3. **AI不回应**
   - 检查OpenAI API密钥
   - 查看后端错误日志

4. **连接失败**
   - 确认Redis服务运行
   - 检查端口占用情况

### 日志查看
- 前端：浏览器开发者工具
- 后端：终端输出

## 贡献指南

欢迎提交Issue和Pull Request！

### 开发流程
1. Fork项目
2. 创建功能分支
3. 提交代码
4. 创建Pull Request

### 代码规范
- 使用TypeScript
- 遵循ESLint规则
- 编写单元测试

## 许可证

MIT License

## 更新日志

### v3.0.0 (2024-12)
- 全新架构设计
- 实时语音识别
- AI语音合成
- 深色主题界面
- 完整的交互流程