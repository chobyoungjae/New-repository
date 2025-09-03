@echo off
chcp 65001 >nul
title 배합일지 자동 업데이트 설정

echo ===============================================
echo 📅 배합일지 자동 업데이트 Windows 작업 등록
echo ===============================================
echo.

echo 현재 작업 디렉토리: %CD%
echo.

echo 🔧 VBA 실행 스크립트 생성 중...

REM VBA 자동 실행 스크립트 생성
echo Option Explicit > run_smart_import.vbs
echo. >> run_smart_import.vbs
echo Dim objExcel, objWorkbook >> run_smart_import.vbs
echo Set objExcel = CreateObject("Excel.Application"^) >> run_smart_import.vbs
echo objExcel.Visible = False >> run_smart_import.vbs
echo Set objWorkbook = objExcel.Workbooks.Open("C:\Users\미쓰리\Desktop\배합일지_데이터.xlsx"^) >> run_smart_import.vbs
echo objExcel.Run "SmartImportFromGoogleSheets" >> run_smart_import.vbs
echo objWorkbook.Save >> run_smart_import.vbs
echo objWorkbook.Close False >> run_smart_import.vbs
echo objExcel.Quit >> run_smart_import.vbs
echo Set objWorkbook = Nothing >> run_smart_import.vbs
echo Set objExcel = Nothing >> run_smart_import.vbs

echo ✅ VBA 실행 스크립트 생성 완료: run_smart_import.vbs
echo.

echo 📋 Windows 작업 스케줄러 등록 명령:
echo.
echo ----------------------------------------
echo schtasks /create /tn "배합일지_자동업데이트" /tr "%CD%\run_smart_import.vbs" /sc minute /mo 5 /ru "%USERNAME%"
echo ----------------------------------------
echo.

echo 위 명령을 관리자 권한 명령 프롬프트에서 실행하면
echo 5분마다 자동으로 새 데이터를 확인하고 가져옵니다.
echo.

pause

echo.
echo 🤖 자동 등록을 시도해볼까요? (Y/N)
set /p choice=선택: 

if /i "%choice%"=="Y" (
    echo.
    echo 📅 작업 스케줄러에 등록 중...
    
    schtasks /create /tn "배합일지_자동업데이트" /tr "%CD%\run_smart_import.vbs" /sc minute /mo 5 /ru "%USERNAME%" /f
    
    if %errorlevel%==0 (
        echo ✅ 자동 업데이트 등록 성공!
        echo    → 5분마다 새 데이터 확인
        echo    → 새 데이터가 있을 때만 엑셀 업데이트
        echo.
        echo 🔍 등록된 작업 확인:
        schtasks /query /tn "배합일지_자동업데이트"
    ) else (
        echo ❌ 등록 실패. 관리자 권한으로 다시 시도해주세요.
    )
) else (
    echo 수동으로 설정하세요.
)

echo.
echo 📖 사용법:
echo 1. 엑셀 파일: C:\Users\미쓰리\Desktop\배합일지_데이터.xlsx
echo 2. VBA 함수: SmartImportFromGoogleSheets (새 데이터만 가져오기)
echo 3. 확인: 작업 스케줄러에서 "배합일지_자동업데이트" 작업 확인
echo.

pause