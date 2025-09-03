@echo off
chcp 65001 >nul
title 배합일지 웹훅 서버

echo ===============================================
echo 🚀 배합일지 웹훅 서버 자동 시작
echo ===============================================
echo.

cd /d "C:\Users\미쓰리\Desktop\깃허브\New-repository\배합일지"

echo 📂 작업 디렉토리: %CD%
echo.

echo 🔍 Python 설치 확인 중...
python --version
if %errorlevel% neq 0 (
    echo ❌ Python이 설치되지 않았습니다!
    echo    https://python.org 에서 Python을 설치해주세요.
    pause
    exit /b 1
)

echo ✅ Python 설치 확인 완료
echo.

echo 📦 Flask 설치 확인 중...
python -c "import flask" 2>nul
if %errorlevel% neq 0 (
    echo ⚠️ Flask가 설치되지 않았습니다. 자동 설치 중...
    pip install flask
    if %errorlevel% neq 0 (
        echo ❌ Flask 설치 실패!
        pause
        exit /b 1
    )
    echo ✅ Flask 설치 완료
)

echo ✅ Flask 설치 확인 완료
echo.

echo 🌐 웹훅 서버 시작 중...
echo    서버 주소: http://localhost:5000
echo    중지하려면: Ctrl+C
echo.

python webhook_server.py

echo.
echo 서버가 중단되었습니다.
pause