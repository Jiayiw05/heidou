@echo off
chcp 65001 >nul
title 会议小参谋 v3.0

cd /d "%~dp0backend"

echo ============================================
echo   会议小参谋 v3.0
echo ============================================
echo.

echo [1/2] 检查 Redis...
redis-cli ping >nul 2>&1
if errorlevel 1 (
    echo   Redis 未运行，正在启动...
    start "" /B redis-server
    timeout /t 3 /nobreak >nul
    echo   Redis 已启动
) else (
    echo   Redis 已运行中
)

echo [2/2] 启动服务...
echo.
echo ============================================
echo   打开以下地址使用会议小参谋:
echo.
echo   本机：   http://localhost:3001
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr "IPv4" ^| findstr /v "192.168.56"') do (
    echo   局域网： http://%%a:3001
)
echo ============================================
echo.
echo   按 Ctrl+C 停止服务
echo.

npm start
