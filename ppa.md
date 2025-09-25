# 카카오 토큰 시스템 연동 아키텍처 (PPA)

## 📋 시스템 개요

이 문서는 **카카오 토큰(github배포)** 폴더의 Google Apps Script와 **kakao-test** 폴더의 Vercel 웹앱 간의 연동 로직을 상세히 설명합니다.

## 🏗️ 아키텍처 구조

```
[Vercel 웹앱] ────HTTP POST───► [Google Apps Script] ────► [Google Sheets]
     ↑                                    ↓
카카오 OAuth                        토큰 저장 & 관리
     ↓                                    ↓
사용자 인증                           친구목록 API 호출
```

## 🔗 핵심 연결 포인트

### 1. **OAuth 인증 플로우 연동**

#### Vercel 측 (`kakao-test/public/oauth.html`)
```javascript
// 카카오 인증 후 토큰 교환
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxOp2ZTsBDt8ohdgxLLD86Ne8zMGN0B3SJ6jr9MMlBmbj2rc_MZKMhXQiP-IxmXXvJn/exec';

// Apps Script로 토큰 전송
await fetch(SCRIPT_URL, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    state: state,           // 사용자 이름
    access_token: data.access_token,
    refresh_token: data.refresh_token
  })
});
```

#### Apps Script 측 (`카카오 토큰(github배포)/Code.js`)
```javascript
function doPost(e) {
  // Vercel에서 받은 토큰 데이터 처리
  const p = e.parameter && Object.keys(e.parameter).length
    ? e.parameter
    : JSON.parse(e.postData.contents || '{}');

  const name = p.state;           // 사용자 이름
  const accessToken = p.access_token;   // Access Token
  const refreshToken = p.refresh_token; // Refresh Token

  // Google Sheets에 토큰 저장
  const sh = ss.getSheetByName('토큰갱신');
  // ... 토큰 저장 로직
}
```

### 2. **API 키 & 설정 동기화**

#### 공통 설정 값
- **REST API Key**: `b753d319ccd4300a4c957d7d4c6c9b96` (양쪽 동일)
- **리디렉트 URI**: `https://kakao-test-ebon.vercel.app/oauth.html`
- **OAuth 스코프**: `talk_message,friends`

#### 친구 목록 동기화
```javascript
// 양쪽 코드에서 동일한 친구 목록 사용
const FRIENDS = [
  '조병재', '강정호', '김가율', '오수진', '윤소연',
  '이재훈', '이지혜', '임용헌', '김철용'
];
```

### 3. **데이터 저장 구조**

#### Google Sheets 구조 (`토큰갱신` 시트)
| 컬럼 | 내용 | 예시 |
|------|------|------|
| A | 사용자 이름 | 조병재 |
| B | Access Token | ya29.a0AfB_byB... |
| C | Refresh Token | 1//0GWthXz9V... |
| D | 토큰 만료일 | 7일 |
| E | 토큰 발급시각 | 2025-05-12 15:30:22 |
| F | 갱신 상태 | 갱신완료 |
| G | 마지막 갱신시각 | 2025-05-12 16:00:15 |

## 🔄 전체 워크플로우

### **Phase 1: 초기 인증**
1. **Vercel**: 사용자가 친구 선택 → 카카오 OAuth 페이지로 리디렉트
2. **카카오**: 사용자 로그인 → Authorization Code 발급
3. **Vercel**: Authorization Code → Access/Refresh Token 교환
4. **Vercel**: 토큰을 Apps Script로 POST 전송
5. **Apps Script**: 토큰을 Google Sheets에 저장 + 가입완료 API 호출

### **Phase 2: 토큰 관리**
1. **Apps Script**: 정기 트리거로 `refreshTokensAndUpdateFriends()` 실행
2. **토큰 갱신**: 모든 사용자의 Refresh Token으로 새 Access Token 발급
3. **친구목록 조회**: 최신 토큰으로 카카오 친구 API 호출
4. **상태 업데이트**: 성공/실패 상태를 시트에 기록

### **Phase 3: 실패 처리**
1. **오류 감지**: 토큰 갱신 실패 또는 API 호출 실패
2. **알림 발송**: 이메일 + 카카오메모로 관리자 알림
3. **상태 기록**: 실패 사유를 시트 F열에 저장

## ⚙️ 기술적 연동 세부사항

### **HTTP 통신 패턴**
```
Vercel (Client) → Apps Script (Server)
Method: POST
Content-Type: application/json
URL: https://script.google.com/macros/s/{SCRIPT_ID}/exec
```

### **Apps Script 배포 설정**
- 실행 권한: `USER_DEPLOYING`
- 액세스 권한: `ANYONE_ANONYMOUS`
- POST 요청만 처리, GET은 안내 메시지만 반환

### **Vercel 배포 설정**
- 정적 파일 호스팅 (`/public` 디렉토리)
- URL 리라이트 규칙 적용
- 자동 HTTPS 및 CDN 지원

## 🔧 주요 함수 매핑

| 기능 | Vercel 함수 | Apps Script 함수 |
|------|-------------|------------------|
| 토큰 저장 | `exchangeToken()` | `doPost()` |
| 토큰 갱신 | - | `refreshAllTokens()` |
| 친구목록 | - | `getKakaoFriendsToSheet()` |
| 실패 알림 | - | `notifyTokenRefreshFailures()` |

## 🛡️ 보안 고려사항

### **토큰 보안**
- Access Token: 2시간 유효 (자동 갱신)
- Refresh Token: 2개월 유효 (주기적 확인)
- 토큰은 Google Sheets에 평문 저장 (시트 권한 관리 중요)

### **API 호출 제한**
- 카카오 API Rate Limit 준수
- 정기 트리거 간격 조정 (현재 일 단위)
- 실패 시 재시도 로직 없음 (다음 트리거까지 대기)

### **크로스 도메인 처리**
- Vercel: CORS 정책 준수
- Apps Script: 모든 도메인 접근 허용 설정

## 📊 모니터링 포인트

### **성공 지표**
- 토큰 갱신 성공률 (F열 "갱신완료" 비율)
- 친구목록 API 응답 성공률
- 정기 트리거 실행 성공률

### **실패 지표**
- HTTP 에러 응답 (400, 401, 500 등)
- JSON 파싱 오류
- 네트워크 타임아웃

## 🔍 디버깅 가이드

### **일반적인 문제**
1. **토큰 갱신 실패**: Refresh Token 만료 → 사용자 재인증 필요
2. **API 호출 실패**: 스코프 권한 부족 → 초기 인증 시 스코프 확인
3. **시트 저장 실패**: 권한 문제 → Apps Script 실행 권한 확인

### **로그 확인 방법**
- Apps Script: 실행 기록에서 오류 로그 확인
- Vercel: Function Logs에서 네트워크 오류 확인
- Google Sheets: F열과 G열에서 상태 및 시간 확인

---

## 📝 업데이트 이력

- **2025-05-12**: 초기 토큰 시스템 구축
- **연동 완료**: Vercel ↔ Apps Script ↔ Google Sheets 파이프라인 구축
- **자동화 완료**: 정기 토큰 갱신 및 친구목록 업데이트 시스템 완료