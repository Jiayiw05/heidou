# Project Context

## Purpose
会议小参谋是一个实时智能会议助手，专注于：
- **实时记录会议内容**：自动记录会议中的所有对话和讨论
- **AI智能分析**：基于记录的聊天内容，调用AI进行分析和理解
- **提供建议和参与讨论**：根据会议内容智能生成建议，并参与用户的讨论
- **辅助决策**：通过AI分析帮助参会者做出更好的决策

核心目标：
- 准确捕捉会议中的每一个观点和建议
- 提供实时的AI分析和建议
- 成为会议的智能参与者，提升会议质量和效率
- 生成会议总结和行动建议

## Tech Stack
- **前端**: React + TypeScript + Tailwind CSS (用于实时界面展示)
- **后端**: Node.js + Express + TypeScript (实时通信和AI集成)
- **AI服务**: 集成OpenAI API/国内大模型API
- **实时通信**: WebSocket / Socket.io (用于实时记录和推送)
- **临时存储**: Redis (会话期间临时存储，会议结束后自动清理)
- **文档**: OpenSpec 驱动的需求管理
- **部署**: Docker + Docker Compose

## Project Conventions

### Code Style
- 使用 TypeScript 进行类型安全开发
- 遵循 ESLint + Prettier 代码格式化规范
- 采用函数式编程和 React Hooks 模式
- 组件命名使用 PascalCase
- 函数和变量使用 camelCase
- 常量使用 UPPER_SNAKE_CASE
- 文件命名使用 kebab-case

### Architecture Patterns
- 前后端分离架构
- WebSocket 实时双向通信
- 事件驱动架构 (Event-Driven)
- 微服务架构 (会议服务、AI服务、通知服务)
- CQRS 模式（读写分离）
- 流式处理架构 (实时处理会议流)

### Testing Strategy
- 单元测试覆盖率 > 80%
- WebSocket 连接测试
- AI API 集成测试
- 实时性能测试
- 使用 Jest + React Testing Library
- WebSocket 测试使用 Socket.io 测试工具

### Git Workflow
- 主分支: `main`
- 开发分支: `develop`
- 功能分支: `feature/功能描述`
- 修复分支: `hotfix/问题描述`
- 提交信息: Conventional Commits 规范
- 代码审查必须通过后才能合并

## Domain Context
会议小参谋专注于实时会议辅助：

**核心概念**：
- 会话 (Session): 一次完整的会议会话
- 消息流 (Message Stream): 会议中实时的对话流
- AI 分析器 (AI Analyzer): 实时分析会议内容的AI引擎
- 建议 (Suggestion): 基于上下文生成的智能建议
- 上下文窗口 (Context Window): AI分析时考虑的历史消息范围
- 实时反馈 (Real-time Feedback): 即时生成的分析和建议

**业务规则**：
- 必须保持低延迟（<500ms）的实时响应
- 支持多人同时发言的记录
- AI建议需要基于完整的上下文理解
- 用户可以选择AI的参与程度
- 保护会议内容的隐私和安全
- 会议结束后，所有聊天内容自动清理，不永久存储
- 仅在会话期间使用Redis临时存储最近的聊天内容

## Important Constraints
- 实时性要求：消息处理延迟 < 500ms
- AI响应时间：建议生成 < 3秒
- 上下文窗口：支持最近50-100条消息的分析（存储在Redis）
- 数据安全：会议内容仅在内存中临时处理，不持久化存储
- 自动清理：会议结束后30分钟内自动清理所有相关数据
- 并发处理：支持100+会议室同时运行
- 准确率要求：语音转文字准确率 > 95%

## External Dependencies
- AI模型服务: OpenAI API / 百度文心一言 / 阿里通义千问
- 语音识别: 讯飞语音API / 腾讯云语音识别
- 实时通信: Socket.io / WebSocket
- 临时存储: Redis (会话期间缓存聊天内容)
- 监控服务: 实时性能监控和错误追踪
