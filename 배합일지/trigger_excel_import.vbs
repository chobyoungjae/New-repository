' =====================================================================
' 엑셀에서 구글 스프레드시트 데이터 자동 가져오기 트리거 스크립트
' Python 웹훅 서버에서 호출됨
' =====================================================================

Option Explicit

' 설정 상수 (바탕화면 엑셀 파일로 수정)
Const EXCEL_FILE_PATH = "C:\Users\미쓰리\Desktop\배합일지_데이터.xlsx"
Const VBA_FUNCTION_NAME = "ImportFromGoogleSheets"

' 메인 실행 부분
Dim objExcel, objWorkbook, spreadsheetId

' 명령줄 인수에서 스프레드시트 ID 가져오기
If WScript.Arguments.Count > 0 Then
    spreadsheetId = WScript.Arguments(0)
Else
    spreadsheetId = ""
End If

' 실행 시작 로그
WScript.Echo "=== 엑셀 데이터 가져오기 트리거 시작 ==="
WScript.Echo "시간: " & Now()
WScript.Echo "Excel 파일: " & EXCEL_FILE_PATH
WScript.Echo "VBA 함수: " & VBA_FUNCTION_NAME

' Excel 파일 존재 확인
Dim fso
Set fso = CreateObject("Scripting.FileSystemObject")

If Not fso.FileExists(EXCEL_FILE_PATH) Then
    WScript.Echo "알림: Excel 파일이 없습니다. 새로 생성합니다: " & EXCEL_FILE_PATH
    ' Excel 파일이 없으면 새로 생성
    Set objExcel = CreateObject("Excel.Application")
    Set objWorkbook = objExcel.Workbooks.Add
    objWorkbook.SaveAs EXCEL_FILE_PATH
    WScript.Echo "새 Excel 파일 생성 완료"
Else
    WScript.Echo "기존 Excel 파일 발견"
End If

On Error Resume Next

' Excel 애플리케이션 생성 (기존 파일 열기)
If objExcel Is Nothing Then
    Set objExcel = CreateObject("Excel.Application")
    If Err.Number <> 0 Then
        WScript.Echo "오류: Excel 애플리케이션을 생성할 수 없습니다: " & Err.Description
        WScript.Quit 1
    End If
    
    ' Excel 파일 열기
    Set objWorkbook = objExcel.Workbooks.Open(EXCEL_FILE_PATH)
    If Err.Number <> 0 Then
        WScript.Echo "오류: Excel 파일을 열 수 없습니다: " & Err.Description
        objExcel.Quit
        WScript.Quit 1
    End If
End If

' Excel 설정
objExcel.Visible = True  ' 사용자가 결과를 볼 수 있도록
objExcel.DisplayAlerts = False
objExcel.ScreenUpdating = False

WScript.Echo "Excel 준비 완료"

' VBA 함수 실행
objExcel.Run VBA_FUNCTION_NAME

If Err.Number <> 0 Then
    WScript.Echo "오류: VBA 함수 실행 실패: " & Err.Description
    WScript.Echo "VBA 모듈이 없거나 함수명이 잘못되었을 수 있습니다."
    objWorkbook.Close False
    objExcel.Quit
    WScript.Quit 1
End If

WScript.Echo "VBA 함수 실행 완료"

' Excel 파일 저장
objWorkbook.Save
objExcel.ScreenUpdating = True

' 객체 해제 (Excel은 열린 상태로 유지)
Set objWorkbook = Nothing
Set objExcel = Nothing
Set fso = Nothing

' 완료 로그
WScript.Echo "=== 엑셀 데이터 가져오기 완료 ==="
WScript.Echo "완료 시간: " & Now()
WScript.Echo "상태: 성공"
WScript.Echo "Excel 파일이 열린 상태로 유지됩니다."

WScript.Quit 0