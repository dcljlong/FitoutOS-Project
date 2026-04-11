Start-Process powershell -ArgumentList '-NoExit','-Command','cd "D:\FitoutOS Project\backend"; uvicorn server:app --reload --port 8010'
Start-Process powershell -ArgumentList '-NoExit','-Command','cd "D:\FitoutOS Project\frontend"; $env:PORT="3000"; npm start'
