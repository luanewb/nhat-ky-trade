@echo off
title Nhat Ky Giao Dich MT5
echo ===================================================
echo   KHOI DONG NHAT KY GIAO DICH MT5
echo ===================================================
echo.
echo Mo trinh duyet tai: http://127.0.0.1:8000
echo (Hay mo MetaTrader 5 truoc neu muon Sync truc tiep)
echo.
start "" http://127.0.0.1:8000
cd /d "%~dp0backend"
python -m uvicorn main:app --host 127.0.0.1 --port 8000
pause
