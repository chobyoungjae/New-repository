Option Explicit

' ========================= 설정 상수 =========================
Private Const SCRIPT_ID = "AKfycbwWkFgXMsfcO1yt1BfUqyLFh6JN41vHghJA4Qw4skUjLre6MCntJyfJOt_gJikRuEWzdQ"
Private Const API_BASE_URL = "https://script.google.com/macros/s/" & SCRIPT_ID & "/exec"

' 새 데이터가 있을 때만 가져오는 스마트 업데이트 함수
Sub SmartImportFromGoogleSheets()
    On Error GoTo ErrorHandler
    
    Application.ScreenUpdating = False
    Application.DisplayAlerts = False
    
    Debug.Print "=== 스마트 데이터 업데이트 시작 ==="
    
    ' 1. API 연결 테스트
    If Not TestGoogleSheetsConnection() Then
        MsgBox "구글 스프레드시트 연결에 실패했습니다." & vbCrLf & _
               "인터넷 연결 및 스크립트 ID를 확인해주세요.", vbCritical, "연결 실패"
        Exit Sub
    End If
    
    ' 2. 마지막 업데이트 시간 가져오기
    Dim lastUpdateTime As String
    lastUpdateTime = GetLastUpdateTime()
    
    ' 3. 새 데이터 확인
    If Not HasNewData(lastUpdateTime) Then
        Debug.Print "새 데이터 없음 - 업데이트 건너뜀"
        Application.ScreenUpdating = True
        Application.DisplayAlerts = True
        MsgBox "새 데이터가 없습니다. 업데이트를 건너뜁니다.", vbInformation, "업데이트 없음"
        Exit Sub
    End If
    
    Debug.Print "새 데이터 발견 - 가져오기 시작"
    
    ' 2. ERP 데이터 가져오기
    Dim jsonResponse As String
    jsonResponse = GetERPDataFromGoogle()
    
    If jsonResponse = "" Then
        MsgBox "데이터를 가져올 수 없습니다.", vbCritical, "데이터 오류"
        Exit Sub
    End If
    
    ' 3. JSON 데이터 파싱
    Dim dataArray As Variant
    If Not ParseERPJsonData(jsonResponse, dataArray) Then
        MsgBox "데이터 파싱에 실패했습니다.", vbCritical, "파싱 오류"
        Exit Sub
    End If
    
    ' 4. 엑셀 시트에 데이터 입력
    Call WriteDataToExcel(dataArray)
    
    Application.ScreenUpdating = True
    Application.DisplayAlerts = True
    
    MsgBox "구글 스프레드시트 데이터 가져오기가 완료되었습니다!" & vbCrLf & _
           "시트명: 1_생산입고II", vbInformation, "완료"
    
    Debug.Print "=== 데이터 가져오기 완료 ==="
    Exit Sub
    
ErrorHandler:
    Application.ScreenUpdating = True
    Application.DisplayAlerts = True
    
    Debug.Print "오류 발생: " & Err.Description
    MsgBox "오류가 발생했습니다: " & vbCrLf & Err.Description, vbCritical, "오류"
End Sub

' ========================= 구글 시트 연결 함수 =========================

' 구글 스프레드시트 연결 테스트
Function TestGoogleSheetsConnection() As Boolean
    On Error GoTo ConnectionError
    
    Debug.Print "구글 스프레드시트 연결 테스트 중..."
    
    Dim http As Object
    
    ' WinHttp 객체 시도 (더 안전한 방법)
    Set http = CreateObject("WinHttp.WinHttpRequest.5.1")
    
    Dim url As String
    url = API_BASE_URL & "?action=health_check"
    Debug.Print "테스트 URL: " & url
    
    ' 타임아웃 설정 (30초)
    http.SetTimeouts 30000, 30000, 30000, 30000
    
    ' SSL 검증 무시 (자체 서명 인증서 문제 해결)
    http.Option(4) = 13056 ' SslErrorIgnoreFlags
    
    http.Open "GET", url, False
    
    ' 헤더 설정
    http.setRequestHeader "User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    http.setRequestHeader "Accept", "application/json, text/plain, */*"
    http.setRequestHeader "Cache-Control", "no-cache"
    
    ' 요청 전송
    http.send
    
    Debug.Print "응답 상태: HTTP " & http.Status
    Debug.Print "응답 내용: " & http.responseText
    
    If http.Status = 200 Then
        Debug.Print "연결 성공!"
        TestGoogleSheetsConnection = True
    ElseIf http.Status = 302 Then
        Debug.Print "리다이렉션 발생 - 권한 승인이 필요할 수 있습니다."
        Debug.Print "브라우저에서 URL을 직접 열어 권한을 승인해주세요: " & url
        TestGoogleSheetsConnection = False
    Else
        Debug.Print "연결 실패 - HTTP " & http.Status
        TestGoogleSheetsConnection = False
    End If
    
    Set http = Nothing
    Exit Function
    
ConnectionError:
    Debug.Print "연결 오류: " & Err.Description
    Debug.Print "XMLHTTP 대신 WinHttp로 시도해보세요."
    
    ' XMLHTTP로 재시도
    On Error GoTo ConnectionError2
    Set http = CreateObject("MSXML2.XMLHTTP")
    http.Open "GET", API_BASE_URL & "?action=health_check", False
    http.send
    
    Debug.Print "XMLHTTP 응답: HTTP " & http.Status
    If http.Status = 200 Then
        TestGoogleSheetsConnection = True
    Else
        TestGoogleSheetsConnection = False
    End If
    
    Set http = Nothing
    Exit Function
    
ConnectionError2:
    Debug.Print "모든 HTTP 객체 실패: " & Err.Description
    TestGoogleSheetsConnection = False
    Set http = Nothing
End Function

' 구글 스프레드시트에서 ERP 데이터 가져오기
Function GetERPDataFromGoogle() As String
    On Error GoTo ApiError
    
    Debug.Print "ERP 데이터 요청 중..."
    
    Dim http As Object
    Set http = CreateObject("WinHttp.WinHttpRequest.5.1")
    
    Dim url As String
    url = API_BASE_URL & "?action=get_erp_data"
    
    ' 타임아웃 설정
    http.SetTimeouts 30000, 30000, 30000, 30000
    
    ' SSL 검증 무시
    http.Option(4) = 13056
    
    http.Open "GET", url, False
    
    ' 헤더 설정 (연결 테스트와 동일하게)
    http.setRequestHeader "User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    http.setRequestHeader "Accept", "application/json, text/plain, */*"
    http.setRequestHeader "Cache-Control", "no-cache"
    
    http.send
    
    Debug.Print "ERP 데이터 응답 상태: HTTP " & http.Status
    Debug.Print "ERP 데이터 응답 내용: " & Left(http.responseText, 200) & "..."
    
    If http.Status = 200 Then
        Debug.Print "데이터 수신 성공"
        GetERPDataFromGoogle = http.responseText
    Else
        Debug.Print "데이터 요청 실패: HTTP " & http.Status
        Debug.Print "전체 응답: " & http.responseText
        GetERPDataFromGoogle = ""
    End If
    
    Set http = Nothing
    Exit Function
    
ApiError:
    Debug.Print "API 오류: " & Err.Description
    GetERPDataFromGoogle = ""
    Set http = Nothing
End Function

' ========================= JSON 파싱 함수 =========================

' JSON 데이터를 배열로 파싱 (간단한 문자열 파싱 방식)
Function ParseERPJsonData(jsonText As String, ByRef dataArray As Variant) As Boolean
    On Error GoTo ParseError
    
    Debug.Print "JSON 데이터 파싱 중..."
    
    ' 데이터 개수 추출
    Dim dataCountPos As Long
    Dim dataCountStr As String
    dataCountPos = InStr(jsonText, """dataCount"":")
    If dataCountPos = 0 Then
        Debug.Print "dataCount를 찾을 수 없습니다."
        ParseERPJsonData = False
        Exit Function
    End If
    
    ' dataCount 값 추출
    Dim startPos As Long
    startPos = InStr(dataCountPos, jsonText, ":") + 1
    Dim endPos As Long
    endPos = InStr(startPos, jsonText, ",")
    dataCountStr = Trim(Mid(jsonText, startPos, endPos - startPos))
    
    Dim dataCount As Long
    dataCount = CLng(dataCountStr)
    Debug.Print "수신된 데이터 개수: " & dataCount
    
    If dataCount = 0 Then
        MsgBox "가져올 데이터가 없습니다.", vbInformation, "데이터 없음"
        ParseERPJsonData = False
        Exit Function
    End If
    
    ' 데이터 배열 초기화 (헤더 포함)
    ReDim dataArray(0 To dataCount, 1 To 23) ' W열까지 23개 열
    
    ' 헤더 설정
    dataArray(0, 1) = "날짜"        ' A열
    dataArray(0, 4) = "담당자"      ' D열
    dataArray(0, 5) = "창고"        ' E열
    dataArray(0, 9) = "업체코드"    ' I열
    dataArray(0, 10) = "세부정보"   ' J열
    dataArray(0, 13) = "총액"       ' M열
    dataArray(0, 17) = "품목코드"   ' Q열
    dataArray(0, 18) = "품목명"     ' R열
    dataArray(0, 20) = "수량"       ' T열
    dataArray(0, 23) = "단가"       ' W열
    
    ' 간단한 JSON 파싱 (문자열 처리)
    Dim dataSection As String
    Dim dataStart As Long
    dataStart = InStr(jsonText, """data"":[") + 8
    Dim dataEnd As Long
    dataEnd = InStrRev(jsonText, "]}")
    dataSection = Mid(jsonText, dataStart, dataEnd - dataStart)
    
    ' 각 데이터 항목 파싱
    Dim items() As String
    items = Split(dataSection, "},{")
    
    Dim i As Long
    For i = 0 To UBound(items)
        If i < dataCount Then
            Dim item As String
            item = items(i)
            
            ' 각 필드 추출
            dataArray(i + 1, 1) = ExtractJsonValue(item, "date")         ' A열: 날짜
            dataArray(i + 1, 4) = ExtractJsonValue(item, "person")       ' D열: 담당자
            dataArray(i + 1, 5) = ExtractJsonValue(item, "warehouse")    ' E열: 창고
            dataArray(i + 1, 9) = ExtractJsonValue(item, "code")         ' I열: 업체코드
            dataArray(i + 1, 10) = ExtractJsonValue(item, "details")     ' J열: 세부정보
            dataArray(i + 1, 13) = ExtractJsonValue(item, "total")       ' M열: 총액
            dataArray(i + 1, 17) = ExtractJsonValue(item, "itemCode")    ' Q열: 품목코드
            dataArray(i + 1, 18) = ExtractJsonValue(item, "itemName")    ' R열: 품목명
            dataArray(i + 1, 20) = ExtractJsonValue(item, "quantity")    ' T열: 수량
            dataArray(i + 1, 23) = ExtractJsonValue(item, "price")       ' W열: 단가
        End If
    Next i
    
    Debug.Print "JSON 파싱 완료: " & dataCount & "개 항목"
    ParseERPJsonData = True
    Exit Function
    
ParseError:
    Debug.Print "파싱 오류: " & Err.Description
    ParseERPJsonData = False
End Function

' JSON에서 특정 값 추출하는 헬퍼 함수
Function ExtractJsonValue(jsonStr As String, fieldName As String) As String
    On Error Resume Next
    
    Dim searchStr As String
    searchStr = """" & fieldName & """:"
    
    Dim startPos As Long
    startPos = InStr(jsonStr, searchStr)
    
    If startPos = 0 Then
        ExtractJsonValue = ""
        Exit Function
    End If
    
    startPos = startPos + Len(searchStr)
    
    ' 값의 시작점 찾기 (따옴표 있는지 확인)
    Dim valueStart As Long
    Dim valueEnd As Long
    Dim hasQuotes As Boolean
    
    If Mid(jsonStr, startPos, 1) = """" Then
        ' 문자열 값
        hasQuotes = True
        valueStart = startPos + 1
        valueEnd = InStr(valueStart, jsonStr, """")
    Else
        ' 숫자 값
        hasQuotes = False
        valueStart = startPos
        valueEnd = InStr(valueStart, jsonStr, ",")
        If valueEnd = 0 Then valueEnd = InStr(valueStart, jsonStr, "}")
    End If
    
    If valueEnd > valueStart Then
        ExtractJsonValue = Mid(jsonStr, valueStart, valueEnd - valueStart)
    Else
        ExtractJsonValue = ""
    End If
End Function

' ========================= 엑셀 데이터 입력 함수 =========================

' 엑셀 시트에 데이터 쓰기
Sub WriteDataToExcel(dataArray As Variant)
    On Error GoTo WriteError
    
    Debug.Print "엑셀 시트에 데이터 쓰기 시작..."
    
    ' 시트 준비
    Dim ws As Worksheet
    Dim sheetName As String
    sheetName = "1_생산입고II"
    
    ' 기존 시트 삭제 후 새로 생성
    Call DeleteSheetIfExists(sheetName)
    Set ws = ThisWorkbook.Worksheets.Add
    ws.Name = sheetName
    
    ' 데이터 개수 확인
    Dim rowCount As Long
    rowCount = UBound(dataArray, 1)
    Debug.Print "입력할 행 수: " & rowCount
    
    ' 데이터 일괄 입력 (A1부터 W까지)
    Dim targetRange As Range
    Set targetRange = ws.Range("A1:W" & rowCount)
    targetRange.Value = dataArray
    
    ' 포맷 적용
    Call ApplyExcelFormatting(ws, rowCount)
    
    ' 시트 활성화
    ws.Activate
    ws.Range("A1").Select
    
    Debug.print "데이터 입력 완료: " & (rowCount - 1) & "개 데이터 행"
    Exit Sub
    
WriteError:
    Debug.Print "쓰기 오류: " & Err.Description
    MsgBox "데이터 쓰기 중 오류가 발생했습니다: " & Err.Description, vbCritical, "쓰기 오류"
End Sub

' 기존 시트 삭제
Sub DeleteSheetIfExists(sheetName As String)
    Dim ws As Worksheet
    
    For Each ws In ThisWorkbook.Worksheets
        If ws.Name = sheetName Then
            Application.DisplayAlerts = False
            ws.Delete
            Application.DisplayAlerts = True
            Debug.Print "기존 시트 삭제: " & sheetName
            Exit Sub
        End If
    Next ws
End Sub

' 엑셀 시트 포맷 적용
Sub ApplyExcelFormatting(ws As Worksheet, rowCount As Long)
    On Error Resume Next
    
    ' 헤더 행 포맷
    With ws.Range("A1:W1")
        .Font.Bold = True
        .Interior.Color = RGB(217, 217, 217)
        .HorizontalAlignment = xlCenter
    End With
    
    ' 숫자 열 포맷 (총액, 수량, 단가)
    ws.Range("M2:M" & rowCount).NumberFormat = "#,##0"      ' 총액
    ws.Range("T2:T" & rowCount).NumberFormat = "#,##0"      ' 수량
    ws.Range("W2:W" & rowCount).NumberFormat = "#,##0"      ' 단가
    
    ' 날짜 열 포맷
    ws.Range("A2:A" & rowCount).NumberFormat = "yyyy-mm-dd"
    
    ' 전체 데이터 범위 테두리
    With ws.Range("A1:W" & rowCount)
        .Borders.LineStyle = xlContinuous
        .Borders.Weight = xlThin
    End With
    
    ' 열 너비 자동 조정
    ws.Columns("A:W").AutoFit
    
    Debug.Print "포맷 적용 완료"
End Sub

' ========================= 테스트 함수 =========================

' 연결 테스트만 실행
Sub TestConnection()
    If TestGoogleSheetsConnection() Then
        MsgBox "구글 스프레드시트 연결 성공!", vbInformation, "연결 테스트"
    Else
        MsgBox "구글 스프레드시트 연결 실패!", vbCritical, "연결 테스트"
    End If
End Sub

' JSON 응답 확인용 테스트
Sub TestGetData()
    Dim response As String
    response = GetERPDataFromGoogle()
    
    If response <> "" Then
        Debug.Print "수신된 JSON 데이터:"
        Debug.Print response
        MsgBox "데이터 수신 성공! 즉시 창(Ctrl+G)에서 JSON 데이터를 확인하세요.", vbInformation, "데이터 테스트"
    Else
        MsgBox "데이터 수신 실패!", vbCritical, "데이터 테스트"
    End If
End Sub

' ========================= 유틸리티 함수 =========================

' 현재 시간 로그
Function GetCurrentTime() As String
    GetCurrentTime = Format(Now(), "yyyy-mm-dd hh:mm:ss")
End Function

' 디버그 로그 출력
Sub DebugLog(message As String)
    Debug.Print "[" & GetCurrentTime() & "] " & message
End Sub

' ========================= 스마트 업데이트 함수 =========================

' 마지막 업데이트 시간 가져오기 (레지스트리에서)
Function GetLastUpdateTime() As String
    On Error Resume Next
    
    Dim lastUpdate As String
    
    ' Excel 애플리케이션에서 커스텀 속성으로 저장/조회
    lastUpdate = ThisWorkbook.CustomDocumentProperties("LastGoogleSheetsUpdate").Value
    
    If Err.Number <> 0 Then
        ' 처음 실행인 경우 빈 문자열 반환
        lastUpdate = ""
        Err.Clear
    End If
    
    Debug.Print "마지막 업데이트 시간: " & lastUpdate
    GetLastUpdateTime = lastUpdate
End Function

' 마지막 업데이트 시간 저장
Sub SaveLastUpdateTime(updateTime As String)
    On Error Resume Next
    
    ' 기존 속성 삭제
    ThisWorkbook.CustomDocumentProperties("LastGoogleSheetsUpdate").Delete
    Err.Clear
    
    ' 새 속성 추가
    ThisWorkbook.CustomDocumentProperties.Add _
        Name:="LastGoogleSheetsUpdate", _
        LinkToContent:=False, _
        Type:=msoPropertyTypeString, _
        Value:=updateTime
    
    Debug.Print "업데이트 시간 저장: " & updateTime
End Sub

' 새 데이터가 있는지 확인
Function HasNewData(lastUpdateTime As String) As Boolean
    On Error GoTo CheckError
    
    Debug.Print "새 데이터 확인 중..."
    
    Dim http As Object
    Set http = CreateObject("WinHttp.WinHttpRequest.5.1")
    
    Dim url As String
    If lastUpdateTime = "" Then
        url = API_BASE_URL & "?action=check_updates"
    Else
        url = API_BASE_URL & "?action=check_updates&lastUpdate=" & lastUpdateTime
    End If
    
    Debug.Print "업데이트 확인 URL: " & url
    
    ' HTTP 설정
    http.SetTimeouts 30000, 30000, 30000, 30000
    http.Option(4) = 13056
    http.Open "GET", url, False
    http.setRequestHeader "User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    http.send
    
    If http.Status = 200 Then
        Dim response As String
        response = http.responseText
        Debug.Print "업데이트 확인 응답: " & response
        
        ' hasUpdates 값 추출 (간단한 문자열 파싱)
        If InStr(response, """hasUpdates"":true") > 0 Then
            Debug.Print "✅ 새 데이터 있음"
            HasNewData = True
        Else
            Debug.Print "⏸️ 새 데이터 없음"
            HasNewData = False
        End If
    Else
        Debug.Print "업데이트 확인 실패: HTTP " & http.Status
        ' 확인 실패 시 안전하게 업데이트 진행
        HasNewData = True
    End If
    
    Set http = Nothing
    Exit Function
    
CheckError:
    Debug.Print "업데이트 확인 오류: " & Err.Description
    ' 오류 시 안전하게 업데이트 진행
    HasNewData = True
    Set http = Nothing
End Function

' 기존 ImportFromGoogleSheets에 업데이트 시간 저장 추가
Sub ImportFromGoogleSheets()
    ' 기존 함수는 그대로 유지하되, 완료 후 시간 저장
    Call ImportFromGoogleSheetsWithTimeTracking()
End Sub

' 시간 추적이 포함된 가져오기 함수
Sub ImportFromGoogleSheetsWithTimeTracking()
    On Error GoTo ErrorHandler
    
    Application.ScreenUpdating = False
    Application.DisplayAlerts = False
    
    Debug.Print "=== 구글 스프레드시트 데이터 가져오기 시작 ==="
    
    ' 강제로 모든 데이터 가져오기
    Dim jsonResponse As String
    jsonResponse = GetERPDataFromGoogle()
    
    If jsonResponse = "" Then
        MsgBox "데이터를 가져올 수 없습니다."
        Exit Sub
    End If
    
    Dim dataArray As Variant
    If ParseERPJsonData(jsonResponse, dataArray) Then
        Call WriteDataToExcel(dataArray)
        Call SaveLastUpdateTime(Format(Now(), "yyyy-mm-dd hh:mm:ss"))
        MsgBox "데이터 가져오기 완료!"
    End If
    
    Application.ScreenUpdating = True
    Application.DisplayAlerts = True
    Exit Sub
    
ErrorHandler:
    Application.ScreenUpdating = True
    Application.DisplayAlerts = True
    MsgBox "오류: " & Err.Description
End Sub