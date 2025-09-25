# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 프로젝트 개요

이 프로젝트는 카카오톡 API를 사용한 토큰 관리 시스템입니다. Google Apps Script로 구현되어 있으며, 카카오 OAuth 토큰의 자동 갱신, 친구 목록 관리, 알림 기능을 제공합니다.

## 핵심 명령어 및 배포

### Clasp 명령어 (Google Apps Script CLI)
```bash
clasp push      # 로컬 코드를 Google Apps Script로 업로드
clasp pull      # Google Apps Script 코드를 로컬로 다운로드
clasp deploy    # 새로운 웹앱 버전 배포
clasp open      # 웹 브라우저에서 Apps Script 에디터 열기
```

### 웹앱 배포 및 테스트
- 배포 시 실행 권한: `USER_DEPLOYING`
- 액세스 권한: `ANYONE_ANONYMOUS`
- POST 요청으로만 토큰 저장 처리
- GET 요청은 안내 메시지만 반환

## 아키텍처 구조

### 메인 파일 구조
- **Code.js**: 메인 토큰 관리 로직
  - `doPost()`: 카카오 OAuth 콜백 처리 및 토큰 저장
  - `refreshAllTokens()`: 전체 사용자 토큰 일괄 갱신
  - `refreshTokensAndUpdateFriends()`: 메인 트리거 함수

- **친구목록불러오기.js**: 카카오 친구 목록 API 연동
  - `getKakaoFriendsToSheet()`: 친구 목록 조회 및 시트 업데이트
  - `logRegularTriggerMapped()`: 트리거 실행 상태 로깅

- **갱신실패 나에게 메일.js**: 토큰 갱신 실패 알림
  - `notifyTokenRefreshFailures()`: 실패 케이스 감지 및 알림 발송

- **토큰 테스트.js**: 문제 사용자 가입 완료 처리
  - `completeSignupForProblemUsers()`: 특정 사용자 가입 상태 보정

### Google Sheets 연동 구조

#### 토큰갱신 시트 (메인 데이터)
- A열: 사용자 이름
- B열: Access Token
- C열: Refresh Token
- D열: 토큰 만료일 (일 단위)
- E열: 토큰 발급 시각
- F열: 갱신 상태 ("갱신완료", "ERROR: ..." 등)
- G열: 마지막 갱신 시각
- H열: 알림 발송 상태 ("SENT")

#### 카카오친구목록 시트
- A열: 친구 이름
- B열: UUID
- C열: 메시지 허용 여부
- F열: 갱신 타임스탬프

#### 정기 트리거 상태 시트 (대시보드용)
- B열: 문서 ID
- E열: 실행 상태 ("✅ 실행됨")
- F열: 실행 시간

### 카카오 API 연동 패턴

#### OAuth 토큰 관리 플로우
1. 외부 로그인 페이지에서 `doPost()` 호출
2. Access/Refresh 토큰을 시트에 저장
3. 사용자 정보 API 1회 호출로 "가입 완료" 상태 보장
4. 정기 트리거로 `refreshAllTokens()` 실행
5. 갱신 실패 시 카카오메모 + 이메일 알림

#### 핵심 보안 설정
- REST API Key: `b753d319ccd4300a4c957d7d4c6c9b96`
- 자동 언링크 방지를 위한 초기 API 호출 필수
- 토큰 만료 시 자동 갱신 및 상태 추적

### 에러 처리 및 모니터링

#### 토큰 갱신 실패 처리
- HTTP 200이 아니거나 `json.error` 존재 시 실패 처리
- 실패 상태를 F열에 기록 (`ERROR: 상세내용`)
- `notifyTokenRefreshFailures()`로 자동 알림

#### 친구 목록 API 실패 처리
- 401 에러: 토큰 만료 안내
- 기타 에러: HTTP 상태 코드와 응답 내용 표시
- 친구 없음 시 "⚠️ 친구 없음" 표시

### 개발 시 주의사항

#### 시트 구조 변경 금지
- 컬럼 순서와 의미가 코드에 하드코딩되어 있음
- 새 컬럼 추가 시 기존 인덱스 영향도 검토 필요

#### 토큰 보안
- Refresh Token은 갱신 시에만 새로 발급될 수 있음
- Access Token 만료 시 Refresh Token으로 재발급 필수
- 토큰 정보는 시트에 평문 저장되므로 시트 공유 권한 주의

#### 트리거 설정
- `refreshTokensAndUpdateFriends()` 함수를 정기 트리거로 등록
- 실행 빈도는 토큰 만료 주기 고려 (보통 1-7일)
- 트리거 실행 상태는 별도 대시보드 시트에서 모니터링

#### 카카오 API 제한사항
- 친구 목록 API는 사용자 동의가 있어야 접근 가능
- 카카오메모 발송은 본인에게만 가능
- API 호출량 제한 고려 필요

## 한국어 변수명 규칙

코드 전반에서 한국어 시트명과 상태값을 사용합니다:
- 시트명: `토큰갱신`, `카카오친구목록`, `정기 트리거 상태`
- 상태값: `갱신완료`, `갱신불가`, `ERROR`
- 사용자명: 실제 한국 이름 사용 (`조병재`, `이지혜` 등)