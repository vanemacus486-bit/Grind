@echo off
title 极简背词
cd /d D:\Dev\Grind\minimemo-electron
echo ✏️  极简背词 (Electron 桌面版) 正在启动...
echo.
npx electron-vite dev 2>&1
pause
