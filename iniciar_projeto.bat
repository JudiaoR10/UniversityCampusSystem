@echo off
chcp 65001 >nul
title Smart Campus - Iniciar Plataforma (Aura David & Milena Cumbane)

echo =======================================================
echo    SMART CAMPUS - UJAC / PTP III
echo    Autoras: Aura David & Milena Cumbane
echo =======================================================
echo.

cd /d "C:\Users\MILENA\Documents\smart-campus-fork"

echo [1/3] A verificar serviços Docker (PostgreSQL e Mosquitto)...
docker compose up -d db mosquitto >nul 2>&1
if errorlevel 1 (
    echo [AVISO] O Docker Desktop pode estar a iniciar. A tentar novamente...
    timeout /t 5 /nobreak >nul
    docker compose up -d db mosquitto
)

echo [2/3] A libertar portas e a preparar aplicacao...
echo.

echo [3/3] A abrir o navegador e iniciar Frontend + API...
start http://localhost:5173

npm run dev

pause
