@echo off
title WARDOGS RUSSIA
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js не найден. Установите с https://nodejs.org
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo Ставлю зависимости...
  call npm install
)

echo Запуск WARDOGS RUSSIA...
call npm start
echo.
echo Бот остановился.
pause
