' =====================================================================
' 이카운트 ERP 자동 업로드 VBA 트리거 스크립트
' Google Apps Script → Python 웹훅 서버 → 이 스크립트 → Excel VBA
' =====================================================================

Option Explicit

' 설정 상수
Const EXCEL_FILE_PATH = "Y:\4000_생산(조병재)\2025년\ERP 생산등록2 자동\ERP생산등록.xlsx"
Const VBA_FUNCTION_NAME = "AutoUploadToICount"

' 메인 실행 부분
Dim objExcel, objWorkbook, spreadsheetId

' 명령줄 인수에서 스프레드시트 ID 가져오기
If WScript.Arguments.Count > 0 Then
    spreadsheetId = WScript.Arguments(0)
Else
    spreadsheetId = ""
End If

' 실행 시작 로그
WScript.Echo "=== 이카운트 VBA 트리거 시작 ==="
WScript.Echo "시간: " & Now()
WScript.Echo "Excel 파일: " & EXCEL_FILE_PATH
WScript.Echo "VBA 함수: " & VBA_FUNCTION_NAME
If spreadsheetId <> "" Then
    WScript.Echo "스프레드시트 ID: " & spreadsheetId
End If

' Excel 파일 존재 확인
Dim fso
Set fso = CreateObject("Scripting.FileSystemObject")

If Not fso.FileExists(EXCEL_FILE_PATH) Then
    WScript.Echo "오류: Excel 파일을 찾을 수 없습니다: " & EXCEL_FILE_PATH
    WScript.Quit 1
End If

On Error Resume Next

' Excel 애플리케이션 생성
Set objExcel = CreateObject("Excel.Application")
If Err.Number <> 0 Then
    WScript.Echo "오류: Excel 애플리케이션을 생성할 수 없습니다: " & Err.Description
    WScript.Quit 1
End If

' Excel 설정
objExcel.Visible = False
objExcel.DisplayAlerts = False
objExcel.ScreenUpdating = False

WScript.Echo "Excel 애플리케이션 생성 완료"

' Excel 파일 열기
Set objWorkbook = objExcel.Workbooks.Open(EXCEL_FILE_PATH)
If Err.Number <> 0 Then
    WScript.Echo "오류: Excel 파일을 열 수 없습니다: " & Err.Description
    objExcel.Quit
    WScript.Quit 1
End If

WScript.Echo "Excel 파일 열기 완료"

' VBA 함수 실행 (스프레드시트 ID 전달)
If spreadsheetId <> "" Then
    objExcel.Run VBA_FUNCTION_NAME, spreadsheetId
Else
    objExcel.Run VBA_FUNCTION_NAME
End If

If Err.Number <> 0 Then
    WScript.Echo "오류: VBA 함수 실행 실패: " & Err.Description
    objWorkbook.Close False
    objExcel.Quit
    WScript.Quit 1
End If

WScript.Echo "VBA 함수 실행 완료"

' Excel 파일 저장 및 종료
objWorkbook.Save
objWorkbook.Close False
objExcel.Quit

' 객체 해제
Set objWorkbook = Nothing
Set objExcel = Nothing
Set fso = Nothing

' 완료 로그
WScript.Echo "=== 이카운트 VBA 트리거 완료 ==="
WScript.Echo "완료 시간: " & Now()
WScript.Echo "상태: 성공"

WScript.Quit 0