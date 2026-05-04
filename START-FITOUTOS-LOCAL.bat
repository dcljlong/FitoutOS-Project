@echo off
title FitoutOS Local Launcher

start "FitoutOS Backend" cmd /k "cd /d ""D:\FitoutOS Project\backend"" && uvicorn server:app --reload --port 8010"
start "FitoutOS Frontend" cmd /k "cd /d ""D:\FitoutOS Project\frontend"" && npm start"

timeout /t 6 >nul
start "" http://localhost:3000

exit
