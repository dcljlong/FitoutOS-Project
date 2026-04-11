@echo off
cd /d "D:\FitoutOS Project\backend"
start "FitoutOS Backend" cmd /k uvicorn server:app --reload --port 8010
timeout /t 3 >nul
cd /d "D:\FitoutOS Project\frontend"
start "FitoutOS Frontend" cmd /k npm start
