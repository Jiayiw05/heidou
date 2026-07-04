## ADDED Requirements

### Requirement: 实时语音识别系统
The system SHALL provide real-time speech recognition based on Whisper with high accuracy for Chinese language, supporting real-time audio stream processing and keyword wake-up.

#### Scenario: 会议语音实时转录
- **WHEN** 用户在会议中说话时
- **THEN** 系统实时将语音转换为文字并显示在界面上
- **AND** 识别准确率必须达到95%以上
- **AND** 延迟时间小于500毫秒

#### Scenario: 关键词唤醒检测
- **WHEN** 系统监听到"小五"、"小5"或"小屋"时
- **THEN** 立即触发AI助手介入
- **AND** 在界面中高亮显示识别到的关键词
- **AND** 启动AI文本生成流程

#### Scenario: 语音活动检测优化
- **WHEN** 检测到静音或停顿时
- **THEN** 暂停Whisper推理以降低资源消耗
- **AND** 使用Silero VAD准确判断语音活动
- **AND** 避免生成幻觉文本

### Requirement: 智能语音合成系统
The system MUST use ChatTTS to provide natural speech synthesis, supporting complete text understanding before generating speech with emotion and intonation.

#### Scenario: 先思考后播报模式
- **WHEN** AI生成完整回复文本后
- **THEN** 系统等待文本完全生成
- **AND** 将完整文本发送给ChatTTS进行推理
- **AND** 生成自然语音后开始播放

#### Scenario: 语音播放控制
- **WHEN** AI正在播放语音时
- **THEN** 用户可通过关键词"小五"或点击按钮打断播放
- **AND** 系统立即停止当前播放
- **AND** 准备接收新的语音指令

#### Scenario: 长文本处理优化
- **WHEN** AI回复超过200字时
- **THEN** 在界面显示"正在整理语音..."提示
- **AND** 实时显示合成进度
- **AND** 保持用户界面响应性

### Requirement: 会话状态管理
The system MUST maintain a clear four-level state system with explicit visual feedback for each state.

#### Scenario: 四级状态转换
- **WHEN** 系统在不同工作阶段时
- **THEN** 显示对应状态：
  - 熄灭：待机状态
  - 绿色呼吸：监听中
  - 紫色快闪：AI思考中
  - 紫色常亮：语音播放中

#### Scenario: 双态会话控制
- **WHEN** 用户点击主按钮时
- **THEN** 按钮在"一起聊聊"和"下次再会"之间切换
- **AND** 对应启动或结束会话
- **AND** 按钮样式随之改变（紫色/灰色）

#### Scenario: 异常状态处理
- **WHEN** 语音合成失败时
- **THEN** 在AI回复卡片底部显示"语音合成失败"
- **AND** 不影响文字内容的阅读
- **AND** 继续监听用户语音