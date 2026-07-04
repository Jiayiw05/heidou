@echo off
chcp 65001 >nul
echo ========================================
echo   会议小参谋 v3.0 - 生产环境启动
echo ========================================
echo.

cd /d "%~dp0backend"

echo [1/3] 检查 Redis...
redis-cli ping >nul 2>&1
if errorlevel 1 (
    echo Redis 未运行，正在启动...
    start "" /B redis-server
    timeout /t 2 /nobreak >nul
    echo Redis 已启动
) else (
    echo Redis 已运行
)

echo [2/3] 设置生产环境变量...
set NODE_ENV=production
set PORT=3001

echo [3/3] 启动服务...
echo.
echo ========================================
echo   服务已启动！
echo.
echo   本机访问: http://localhost:3001
echo.

:: 获取本机 IP
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do (
    set ip=%%a
    set ip=!ip: =!
    if not "!ip!"=="" (
        echo   局域网访问: http://!ip!:3001
    )
)

echo ========================================
echo.
echo   按 Ctrl+C 停止服务
echo.

npm run dev
