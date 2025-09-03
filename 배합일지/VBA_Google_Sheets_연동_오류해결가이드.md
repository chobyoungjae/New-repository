# VBA ↔ Google Sheets API 연동 오류 해결 가이드

## 🔍 발생했던 주요 오류들과 해결 과정

### 1. HTTP 404 "페이지를 찾을 수 없습니다" 오류

#### 원인
- 구글 앱스 스크립트가 웹 앱으로 배포되지 않음
- 잘못된 스크립트 ID 사용

#### 해결 방법
1. **Google Apps Script 웹 앱 배포 필수**:
   ```
   배포 → 새 배포 → 유형: 웹 앱
   실행 계정: 나
   액세스 권한: 모든 사용자 (중요!)
   ```

2. **올바른 스크립트 ID 확인**:
   - 웹 앱 URL: `https://script.google.com/macros/s/SCRIPT_ID/exec`
   - `.clasp.json`의 `scriptId`와 웹 앱 배포 ID는 **다를 수 있음**
   - 반드시 **웹 앱 URL의 ID**를 사용해야 함

### 2. "액세스가 거부되었습니다" 오류

#### 원인
- VBA에서 HTTPS 요청 시 보안 설정 문제
- XMLHTTP 객체의 SSL/TLS 처리 제한
- Windows 보안 정책에 의한 차단

#### 해결 방법
1. **WinHttp 객체 사용** (XMLHTTP 대신):
   ```vba
   Set http = CreateObject("WinHttp.WinHttpRequest.5.1")
   ```

2. **SSL 검증 무시 설정**:
   ```vba
   http.Option(4) = 13056 ' SslErrorIgnoreFlags
   ```

3. **적절한 헤더 설정**:
   ```vba
   http.setRequestHeader "User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
   http.setRequestHeader "Accept", "application/json, text/plain, */*"
   http.setRequestHeader "Cache-Control", "no-cache"
   ```

### 3. "클래스가 등록되지 않았습니다" 오류 (JSON 파싱)

#### 원인
- 64비트 Excel에서 ScriptControl 객체 지원 안 됨
- ScriptControl은 32비트 전용 ActiveX 컨트롤

#### 해결 방법
**문자열 파싱 방식으로 JSON 처리**:
```vba
' ScriptControl 대신 문자열 함수 사용
Function ExtractJsonValue(jsonStr As String, fieldName As String) As String
    Dim searchStr As String
    searchStr = """" & fieldName & """:"
    ' InStr, Mid 등 기본 VBA 문자열 함수 활용
End Function
```

### 4. doGet 함수 매개변수 오류

#### 원인
- Apps Script의 `doGet(e)` 함수에서 `e.parameter`가 `undefined`인 경우 미처리

#### 해결 방법
```javascript
function doGet(e) {
  try {
    // 매개변수 없는 경우 처리
    if (!e || !e.parameter) {
      return ContentService.createTextOutput(JSON.stringify({
        status: 'ok',
        message: 'API 서버가 정상 작동 중입니다.',
        availableActions: ['get_erp_data', 'health_check']
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    const action = e.parameter.action;
    // ... 나머지 로직
  }
}
```

## ⚠️ 향후 재발 방지를 위한 체크리스트

### Google Apps Script 배포 시
- [ ] **웹 앱 배포** 필수 (스크립트 배포만으로는 불충분)
- [ ] **액세스 권한**: "모든 사용자"로 설정
- [ ] **실행 계정**: "나"로 설정
- [ ] **배포 URL 복사**: 웹 앱 URL에서 스크립트 ID 정확히 확인
- [ ] **브라우저 테스트**: VBA 연동 전에 브라우저에서 API 응답 확인

### VBA HTTP 연결 시
- [ ] **WinHttp 객체 우선 사용**:
   ```vba
   CreateObject("WinHttp.WinHttpRequest.5.1")
   ```
- [ ] **SSL 설정 추가**:
   ```vba
   http.Option(4) = 13056
   ```
- [ ] **적절한 헤더 설정** (User-Agent, Accept 등)
- [ ] **타임아웃 설정**: `http.SetTimeouts 30000, 30000, 30000, 30000`

### JSON 파싱 시
- [ ] **64비트 Excel 호환성** 확인
- [ ] **ScriptControl 사용 금지** (64비트에서 지원 안 됨)
- [ ] **문자열 파싱 방식 활용**:
   ```vba
   InStr, Mid, Split 등 기본 VBA 함수 사용
   ```

### 오류 디버깅 시
- [ ] **상세한 로그 출력**:
   ```vba
   Debug.Print "요청 URL: " & url
   Debug.Print "응답 상태: HTTP " & http.Status
   Debug.Print "응답 내용: " & http.responseText
   ```
- [ ] **단계별 테스트**:
   1. 브라우저에서 API 테스트
   2. VBA 연결 테스트만
   3. 데이터 수신 테스트만
   4. 전체 통합 테스트

## 📋 올바른 구현 순서

### 1단계: Google Apps Script 준비
```javascript
// doGet 함수에 매개변수 체크 추가
function doGet(e) {
  if (!e || !e.parameter) {
    return ContentService.createTextOutput("API 정상 작동");
  }
  // ...
}
```

### 2단계: 웹 앱 배포
- 배포 → 새 배포 → 웹 앱
- 모든 사용자 액세스 권한

### 3단계: 브라우저 테스트
```
https://script.google.com/macros/s/SCRIPT_ID/exec
https://script.google.com/macros/s/SCRIPT_ID/exec?action=health_check
```

### 4단계: VBA 구현
```vba
' WinHttp + SSL 무시 + 적절한 헤더
Private Const SCRIPT_ID = "실제_웹앱_배포_스크립트_ID"

Function TestConnection() As Boolean
    Set http = CreateObject("WinHttp.WinHttpRequest.5.1")
    http.Option(4) = 13056
    http.setRequestHeader "User-Agent", "Mozilla/5.0..."
    ' ...
End Function
```

### 5단계: 문자열 기반 JSON 파싱
```vba
' ScriptControl 대신 문자열 함수 사용
Function ExtractJsonValue(jsonStr, fieldName) As String
    ' InStr, Mid 등 활용
End Function
```

## 💡 핵심 포인트

1. **웹 앱 배포 ID ≠ 스크립트 ID**: 반드시 웹 앱 URL의 ID 사용
2. **WinHttp > XMLHTTP**: 보안 이슈 해결을 위해 WinHttp 우선
3. **문자열 파싱 > ScriptControl**: 64비트 호환성을 위해
4. **단계별 테스트**: 브라우저 → 연결 → 데이터 → 통합 순서로

이 가이드를 따르면 VBA ↔ Google Sheets API 연동에서 주요 오류들을 사전에 방지할 수 있습니다.