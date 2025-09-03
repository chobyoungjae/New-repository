# VBA로 구글 스프레드시트 데이터 가져오기 사용법

## 📁 최종 파일 구성

### 필요한 파일
- `GoogleSheets_To_Excel.vba` - 메인 VBA 코드 (유일한 필요 파일)
- `VBA_Google_Sheets_연동_오류해결가이드.md` - 오류 해결 참조용

### 삭제된 불필요한 파일들
- ❌ `ICountAutomation_Final.vba` 
- ❌ `ICountAutomation_Complete.vba`
- ❌ `PRD2.md`

## 🚀 사용 방법

### 1단계: VBA 코드 설치
1. **엑셀 열기** → **Alt + F11** (VBA 에디터)
2. **삽입** → **모듈** → 새 모듈 추가
3. `GoogleSheets_To_Excel.vba` 내용을 모듈에 복사

### 2단계: 실행
```vba
' 전체 실행 (데이터 자동 가져오기)
Sub ImportFromGoogleSheets()

' 개별 테스트
Sub TestConnection()        ' 연결 테스트만
Sub TestGetData()          ' 데이터 수신 테스트만
```

### 3단계: 결과 확인
- **새 시트**: "1_생산입고II" 자동 생성
- **데이터**: 구글 스프레드시트 ERP 데이터 자동 입력
- **포맷**: 헤더, 숫자 형식, 테두리 자동 적용

## 💡 핵심 개선사항

### Before (문제가 있던 방식)
- ❌ XMLHTTP 객체 → 보안 오류
- ❌ ScriptControl JSON 파싱 → 64비트 미지원
- ❌ 스크립트 ID 혼동 → 404 오류

### After (개선된 방식)
- ✅ **WinHttp 객체** + SSL 무시 설정
- ✅ **문자열 기반 JSON 파싱** (64비트 호환)
- ✅ **웹 앱 배포 ID** 정확히 사용

## ⚡ 자동화 체인

```
1. 구글 시트 "생산뷰" 메뉴 → "타임스템프 이동"
   ↓
2. 뷰 시트 → ERP 시트 변환 (Google Apps Script)
   ↓  
3. VBA ImportFromGoogleSheets() 실행
   ↓
4. 엑셀 "1_생산입고II" 시트에 데이터 자동 입력
```

## 🛡️ 안정성 보장

### 연결 안정성
- WinHttp 객체로 HTTPS 연결 안정화
- SSL 검증 무시로 보안 오류 방지
- 타임아웃 30초 설정으로 무한 대기 방지

### 데이터 안정성  
- JSON 파싱 오류 시 상세 로그 출력
- 기존 시트 삭제 후 새로 생성 (데이터 중복 방지)
- 단계별 오류 체크 및 사용자 알림

### 호환성
- 32비트/64비트 Excel 모두 지원
- Windows 10/11 호환
- 최신 Google Apps Script API 지원

## 📋 트러블슈팅

### 연결 실패 시
1. **브라우저 테스트** 먼저:
   ```
   https://script.google.com/macros/s/AKfycbxk_NJLpp2ku35wBMSnRPwzFelitZmM0DkS__7FI4Oou2PgL7nVrCRDlRWUW2TWESw4_g/exec?action=health_check
   ```
2. **스크립트 ID 확인**: 웹 앱 배포 URL의 ID 사용
3. **구글 앱스 스크립트 재배포**: 새 배포 → 웹 앱

### 데이터 파싱 실패 시
- **Ctrl + G** (즉시 창)에서 상세 로그 확인
- JSON 응답 형식 변경 시 `ExtractJsonValue` 함수 수정

## 🎯 향후 활용법

### 정기 업데이트
```vba
Sub 자동업데이트()
    Call ImportFromGoogleSheets()
    MsgBox "최신 데이터 업데이트 완료!"
End Sub
```

### 배치 처리
- 여러 시트 동시 업데이트
- 예약 실행 설정 (Windows 작업 스케줄러)

### 확장 가능성
- 다른 구글 시트 연동 (스크립트 ID만 변경)
- 추가 API 액션 개발 (health_check, get_erp_data 외)

이제 Y:\ 네트워크 드라이브 없이도 안정적으로 구글 스프레드시트 데이터를 엑셀로 가져올 수 있습니다!