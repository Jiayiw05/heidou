## ADDED Requirements

### Requirement: 沉浸式深色主题界面
The system MUST provide an immersive dark-themed interface with pure black background, using specified color scheme to reduce light interference and highlight important information.

#### Scenario: 界面配色应用
- **WHEN** 用户打开应用时
- **THEN** 背景色为纯黑(#000000)
- **AND** 功能色按规范使用：
  - 监听/活跃：荧光绿(#00E676)
  - AI思考/处理：电光紫(#7B61FF)
  - 结束/待机：深灰(#2C2C2E)

#### Scenario: 文本层次显示
- **WHEN** 显示不同类型文本时
- **THEN** AI回复使用白色(#FFFFFF) PingFang SC Medium 16px
- **AND** 转录文本使用浅灰(#8E8E93) PingFang SC Regular 14px
- **AND** 保持良好的可读性

### Requirement: 响应式布局系统
The system SHALL implement a three-tier responsive layout: top status bar, middle conversation flow, and bottom control panel, adapting to different screen sizes.

#### Scenario: 顶部状态感知栏
- **WHEN** 应用运行时
- **THEN** 顶部居中显示"会议小参谋"标题
- **AND** 标题旁显示状态指示灯
- **AND** 指示灯根据当前状态显示不同颜色和动画

#### Scenario: 中部对话流展示
- **WHEN** 显示对话内容时
- **THEN** 用户语音转录使用灰字左对齐，无气泡
- **AND** AI回复使用紫色圆角卡片，白字左对齐
- **AND** AI卡片底部包含语音状态条

#### Scenario: 底部控制台
- **WHEN** 用户需要控制时
- **THEN** 左侧显示"清除历史"按钮（垃圾桶图标）
- **AND** 中央显示双态主控按钮
- **AND** 按钮根据状态切换文案和样式

### Requirement: 动态视觉反馈系统
The system SHALL provide smooth animation effects including ripples, breathing effects, and visualizations to enhance user experience.

#### Scenario: 绿色波纹效果
- **WHEN** 系统处于监听状态时
- **THEN** 主按钮周围产生绿色波纹
- **AND** 波纹强度根据麦克风输入电平变化
- **AND** 动画保持60fps流畅度

#### Scenario: 音频可视化效果
- **WHEN** 播放AI语音时
- **THEN** AI卡片底部显示音频柱状图
- **AND** 柱状图随音频节奏跳动
- **AND** 提供直观的播放进度反馈

#### Scenario: 状态转换动画
- **WHEN** 系统状态改变时
- **THEN** 平滑过渡到新状态
- **AND** 使用fade或slide动画
- **AND** 避免突兀的界面变化

### Requirement: 交互响应优化
The system MUST provide immediate interactive feedback to ensure responsiveness of user operations.

#### Scenario: 按钮点击反馈
- **WHEN** 用户点击按钮时
- **THEN** 立即提供视觉反馈（如轻微缩放）
- **AND** 快速执行相应操作
- **AND** 在300毫秒内完成反馈

#### Scenario: 加载状态提示
- **WHEN** 系统处理请求时
- **THEN** 显示清晰的加载指示器
- **AND** 提供有意义的提示文本
- **AND** 保持用户界面可操作

#### Scenario: 错误状态处理
- **WHEN** 发生错误时
- **THEN** 显示友好的错误信息
- **AND** 提供恢复选项
- **AND** 保持应用继续运行