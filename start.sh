#!/bin/bash

# 会议小参谋启动脚本

echo "🚀 启动会议小参谋..."

# 检查Redis是否运行
if ! pgrep -x redis-server > /dev/null; then
    echo "⚠️  Redis未运行，请先启动Redis服务"
    echo "   macOS: brew services start redis"
    echo "   Ubuntu: sudo systemctl start redis-server"
    exit 1
fi

# 检查后端.env文件
if [ ! -f backend/.env ]; then
    echo "📝 创建后端环境配置文件..."
    cp backend/.env.example backend/.env
    echo "⚠️  请编辑 backend/.env 文件，设置 OPENAI_API_KEY"
fi

# 检查前端.env文件
if [ ! -f frontend/.env ]; then
    echo "📝 创建前端环境配置文件..."
    cp frontend/.env.example frontend/.env
fi

# 启动后端服务
echo "🔧 启动后端服务..."
cd backend
npm run dev &
BACKEND_PID=$!
cd ..

# 等待后端启动
sleep 3

# 启动前端服务
echo "🎨 启动前端服务..."
cd frontend
npm start &
FRONTEND_PID=$!
cd ..

echo ""
echo "✅ 会议小参谋已启动！"
echo ""
echo "📍 访问地址："
echo "   前端: http://localhost:3000"
echo "   后端: http://localhost:3001"
echo ""
echo "🔧 控制命令："
echo "   停止服务: 按 Ctrl+C"
echo "   查看日志: 检查终端输出"
echo ""
echo "💡 提示："
echo "   1. 确保已安装所有依赖 (运行 npm install)"
echo "   2. 确保Redis服务正在运行"
echo "   3. 如需使用OpenAI，请在 backend/.env 中设置 API 密钥"
echo ""

# 等待用户中断
trap 'echo ""; echo "🛑 正在停止服务..."; kill $BACKEND_PID 2>/dev/null; kill $FRONTEND_PID 2>/dev/null; exit' INT

# 保持脚本运行
wait