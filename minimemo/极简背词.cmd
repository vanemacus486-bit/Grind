@echo off
title 极简背词
cd /d "%~dp0"
echo ✏️  极简背词 已启动
echo 浏览器打开后即可使用，关闭此窗口即停止服务。
echo.
start http://localhost:5173
npx vite --host 2>&1
pause
