# PRD: 웹훅 기반 Google Sheets ↔ 이카운트 완전 자동화 시스템

## 1. 프로젝트 개요

### 1.1 목적
Google Apps Script → 웹훅 → 로컬 Python 서버 → Excel VBA → 이카운트 자동 업로드의 완전 자동화 파이프라인 구축

### 1.2 핵심 가치
- **원클릭 완전 자동화**: 스프레드시트 버튼 하나로 이카운트까지 업로드 완료
- **실시간 연동**: 클라우드 → 로컬 → ERP 시스템 즉시 연결
- **확장 가능**: 다른 ERP 시스템도 쉽게 추가 가능
- **안정성**: 각 단계별 오류 처리 및 재시도 로직

## 2. 시스템 아키텍처

### 2.1 전체 데이터 플로우

```
[Google Sheets] 
    ↓ (1) 데이터 변환 및 준비
[Google Apps Script]
    ↓ (2) HTTP 웹훅 POST
[로컬 Python 서버] (localhost:5000)
    ↓ (3) VBA 스크립트 실행 트리거
[Excel VBA]
    ↓ (4) Google Sheets API 호출
[Google Sheets 데이터 가져오기]
    ↓ (5) 로컬 Excel 파일 업데이트
[Y:\4000_생산(조병재)\2025년\ERP 생산등록2 자동\ERP생산등록.xlsx]
    ↓ (6) 이카운트 프로그램 자동화
[이카운트 ERP 시스템]
```

### 2.2 구성 요소

#### 2.2.1 Google Apps Script (클라우드)
- **역할**: 데이터 변환 + 웹훅 발송 + API 제공
- **기능**: 
  - 시트1 → 뷰 → ERP 데이터 변환
  - 로컬 서버로 웹훅 신호 전송
  - VBA가 호출할 수 있는 REST API 제공

#### 2.2.2 로컬 Python 서버 (PC 백그라운드)
- **역할**: 웹훅 수신 + VBA 트리거
- **기능**:
  - 포트 5000에서 웹훅 대기
  - 신호 받으면 VBA 스크립트 실행
  - 5MB 미만의 경량 서버

#### 2.2.3 Excel VBA (로컬 Excel)
- **역할**: 데이터 동기화 + 이카운트 자동화
- **기능**:
  - Google Sheets API에서 변환된 데이터 가져오기
  - 로컬 Excel 파일에 데이터 입력
  - 이카운트 프로그램 UI 자동화

## 3. 기능 요구사항

### 3.1 Google Apps Script 기능

#### 3.1.1 기존 기능 확장
```javascript
function moveTimestamps() {
  // 기존 로직...
  
  // 완료 후 웹훅 발송
  sendWebhookTrigger('icount_upload', {
    timestamp: new Date(),
    dataCount: processedRows
  });
}
```

#### 3.1.2 데이터 API 제공
```javascript
function doGet(e) {
  const action = e.parameter.action;
  
  switch(action) {
    case 'get_erp_data':
      return getERPDataForAPI();
    case 'health_check':
      return {status: 'ok', timestamp: new Date()};
    default:
      return {error: 'Invalid action'};
  }
}
```

#### 3.1.3 웹훅 발송
```javascript
function sendWebhookTrigger(action, data) {
  UrlFetchApp.fetch('http://localhost:5000/webhook', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    payload: JSON.stringify({
      action: action,
      data: data,
      timestamp: new Date().toISOString()
    })
  });
}
```

### 3.2 Python 웹훅 서버 기능

#### 3.2.1 웹훅 수신 서버
```python
from flask import Flask, request, jsonify
import subprocess
import json
import logging

app = Flask(__name__)

@app.route('/webhook', methods=['POST'])
def handle_webhook():
    try:
        data = request.json
        action = data.get('action')
        
        if action == 'icount_upload':
            # VBA 스크립트 실행
            result = subprocess.run([
                'cscript', '//NoLogo', 
                'trigger_icount_upload.vbs'
            ], capture_output=True, text=True)
            
            return jsonify({
                'status': 'success',
                'message': 'VBA execution triggered',
                'vba_output': result.stdout
            })
            
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500

if __name__ == '__main__':
    app.run(host='localhost', port=5000, debug=False)
```

#### 3.2.2 VBA 트리거 스크립트
```vbs
' trigger_icount_upload.vbs
Set xl = CreateObject("Excel.Application")
xl.Visible = False
xl.DisplayAlerts = False

Set wb = xl.Workbooks.Open("Y:\4000_생산(조병재)\2025년\ERP 생산등록2 자동\ERP생산등록.xlsx")
xl.Run "AutoUploadToICount"

wb.Close False
xl.Quit
Set xl = Nothing

WScript.Echo "VBA execution completed"
```

### 3.3 Excel VBA 기능

#### 3.3.1 메인 자동화 함수
```vba
Sub AutoUploadToICount()
    On Error GoTo ErrorHandler
    
    ' 1단계: Google Sheets에서 데이터 가져오기
    Call FetchDataFromGoogleSheets
    
    ' 2단계: 이카운트 로그인 및 업로드
    Call UploadToICount
    
    ' 3단계: 완료 처리
    MsgBox "이카운트 업로드 완료!", vbInformation
    
    Exit Sub
    
ErrorHandler:
    MsgBox "오류 발생: " & Err.Description, vbCritical
End Sub
```

## 4. 설치 및 설정

### 4.1 설치 순서 (5분 완료)

#### 4.1.1 Python 서버 설치
```bash
# 1. Python 가상환경 생성
python -m venv webhook_server
webhook_server\Scripts\activate

# 2. Flask 설치
pip install flask

# 3. 서버 스크립트 저장
# webhook_server.py 파일 생성

# 4. 백그라운드 실행
python webhook_server.py
```

#### 4.1.2 VBA 트리거 스크립트 설치
```
Y:\4000_생산(조병재)\2025년\ERP 생산등록2 자동\
├── ERP생산등록.xlsx (기존 파일)
├── trigger_icount_upload.vbs (새로 생성)
└── webhook_server.py (새로 생성)
```

#### 4.1.3 Excel VBA 코드 추가
- `ERP생산등록.xlsx` 파일에 VBA 모듈 추가
- `AutoUploadToICount()` 함수 구현

### 4.2 자동 시작 설정

#### 4.2.1 Windows 시작 시 Python 서버 자동 실행
```batch
REM startup.bat
cd "Y:\4000_생산(조병재)\2025년\ERP 생산등록2 자동"
python webhook_server.py
```

## 5. 실행 시나리오

### 5.1 사용자 관점 (원클릭)
1. **Google Sheets 열기**
2. **"생산뷰" → "🔄 전체 자동 실행" 클릭**
3. **완료 대기** (1-2분)
4. **이카운트에서 데이터 확인**

### 5.2 시스템 내부 처리 (자동)
```
00:00 [Apps Script] 타임스탬프 이동 시작
00:05 [Apps Script] 뷰 → ERP 변환 시작
00:10 [Apps Script] 웹훅 신호 발송
00:11 [Python] 웹훅 수신, VBA 트리거 실행
00:12 [VBA] Google Sheets API 호출
00:15 [VBA] 로컬 Excel 파일 업데이트
00:20 [VBA] 이카운트 자동화 시작
00:45 [VBA] 이카운트 업로드 완료
00:46 [시스템] 전체 프로세스 완료
```

## 6. 복잡도 분석

### 6.1 개발 복잡도
- **Google Apps Script**: ⭐⭐☆☆☆ (기존 코드 + 웹훅 5줄)
- **Python 서버**: ⭐☆☆☆☆ (Flask 기본 템플릿)
- **VBA 코드**: ⭐⭐⭐☆☆ (HTTP 요청 + UI 자동화)
- **전체 설정**: ⭐⭐☆☆☆ (파일 복사 + 실행)

### 6.2 유지보수 복잡도
- **매우 낮음**: 각 구성요소가 독립적
- **디버깅 용이**: 각 단계별 로그 확인 가능
- **확장성**: 새로운 연동 시스템 쉽게 추가

## 7. 기술 사양

### 7.1 필요 환경
- **Python 3.8+** (Flask 서버용)
- **Excel 2016+** (VBA 실행용)
- **이카운트 프로그램** (설치됨)
- **네트워크**: localhost 통신

### 7.2 성능 예상
- **Google Sheets 처리**: 3-5초
- **웹훅 전송**: 0.1초
- **VBA 실행**: 10-30초 (이카운트 속도에 따라)
- **전체 소요시간**: 1-2분

## 8. 구현 우선순위

### 8.1 1단계: Google Apps Script 웹훅 발송
```javascript
// 기존 Code.js에 웹훅 함수 추가
function sendWebhookToLocal(action, data) {
  // 웹훅 구현
}
```

### 8.2 2단계: Python 웹훅 서버
```python
# webhook_server.py 생성
# 포트 5000에서 대기
# VBA 트리거 구현
```

### 8.3 3단계: VBA 자동화
```vba
' Google Sheets API 연동
' 이카운트 UI 자동화
' 오류 처리 로직
```

### 8.4 4단계: 통합 테스트
- 전체 파이프라인 검증
- 오류 상황 대응 테스트
- 성능 최적화

## 9. 성공 기준

### 9.1 정량적 목표
- **자동화율**: 100% (사용자 개입 없음)
- **성공률**: 98% 이상
- **처리 시간**: 2분 이내
- **안정성**: 주 5일 연속 정상 동작

### 9.2 사용자 경험
- **원클릭 실행**: 버튼 하나로 완료
- **실시간 피드백**: 각 단계별 진행상황 표시
- **명확한 결과**: 성공/실패 명확한 알림

## 10. 위험 요소 및 대응

### 10.1 주요 위험
- **네트워크 연결**: localhost 통신 실패
- **Python 서버 다운**: 웹훅 수신 불가
- **이카운트 UI 변경**: 자동화 스크립트 실패

### 10.2 대응 방안
- **재시도 로직**: 3회 재시도 후 알림
- **헬스체크**: Python 서버 상태 주기적 확인
- **수동 모드**: 자동화 실패 시 수동 처리 가이드

## 11. 구현 단계별 일정

### 11.1 Week 1: 기반 시스템
- [ ] Google Apps Script 웹훅 발송 기능
- [ ] Python 웹훅 서버 구현
- [ ] 기본 통신 테스트

### 11.2 Week 2: VBA 자동화
- [ ] Google Sheets API 연동 VBA
- [ ] 이카운트 UI 자동화 VBA
- [ ] Excel 파일 업데이트 로직

### 11.3 Week 3: 통합 및 최적화
- [ ] 전체 파이프라인 연동 테스트
- [ ] 오류 처리 및 재시도 로직
- [ ] 성능 최적화 및 사용자 가이드

## 12. 최종 사용법

### 12.1 일일 업무 프로세스
```
오전: 생산 데이터 입력 (Google Sheets)
오후: "생산뷰" → "🔄 전체 자동 실행" 클릭
결과: 이카운트에 자동으로 데이터 업로드 완료
```

### 12.2 시스템 관리
- **Python 서버**: Windows 시작 시 자동 실행
- **모니터링**: 웹훅 로그 및 VBA 실행 로그 확인
- **백업**: 업로드 전 로컬 Excel 파일 자동 백업

## 13. 확장 계획

### 13.1 단기 확장 (3개월)
- **알림 시스템**: 카카오톡/이메일 완료 알림
- **스케줄링**: 매일 오후 6시 자동 실행
- **대시보드**: 실행 현황 웹 대시보드

### 13.2 장기 확장 (6개월)
- **다중 ERP 연동**: 더존, SAP 등 추가 연동
- **실시간 동기화**: 데이터 변경 시 즉시 업로드
- **모바일 제어**: 스마트폰에서 원격 실행

이 PRD로 진행하면 **완전 자동화된 이카운트 연동 시스템**을 구축할 수 있습니다!