# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 프로젝트 개요

이 프로젝트는 **1동 제품검수일지 대시보드 시스템**입니다. Google Sheets와 Google Apps Script를 사용하여 제품 생산 과정의 작업 상태를 추적하고, 팀장 서명을 통한 승인 워크플로우를 관리합니다.

## 주요 명령어

### 배포 명령어

```bash
# Google Apps Script 배포 (clasp 사용)
clasp push    # 코드를 Google Apps Script에 업로드
clasp deploy  # 새 버전으로 배포
```

### 테스트 명령어

- Google Apps Script 환경에서는 별도의 테스트 프레임워크가 없습니다
- 함수 테스트는 Google Apps Script 에디터에서 직접 실행하거나 Logger.log()를 사용합니다

## 아키텍처 구조

### 핵심 구성요소

1. **워크플로우 트리거 시스템** (`Code.js:92-145`)

   - `onFormSubmit()`: 폼 제출 시 작업 상태에 따른 처리
   - 작업 시작 시 → 개별 시트 생성
   - 작업 중 → 시간 기록
   - 제품생산 완료 → 팀장 보드 전송

2. **웹앱 엔드포인트** (`Code.js:147-195`)

   - `doGet()`: 팀장 서명 처리 웹앱
   - URL 파라미터: `role`, `row`
   - 서명 완료 후 PDF 생성 및 시트 삭제

3. **시트 관리 시스템** (`Code.js:31-89`)

   - `getLatestSheet()`: 중복 시트명 처리
   - `generateBaseName()`: 고유 시트명 생성
   - `findOrCreateSheetName()`: 시트 찾기/생성 로직

4. **PDF 생성 시스템** (`Code.js:271-422`)
   - `createPdfFromSheet()`: 시트를 PDF로 변환
   - 기존 파일 휴지통 이동 후 새 파일 생성
   - 동시 실행 방지를 위한 Lock 사용

### 데이터 구조

**시트 구조:**

- `A시트`: 메인 데이터 (CFG.DATA)
- `문서`: 개인 템플릿 (CFG.TEMPLATE)
- `B시트`: 이름→대시보드ID 매핑 (CFG.LOOKUP)
- `문서ID`: 스프레드시트ID→스크립트ID→URL 매핑 (CFG.MAP_ID)

**주요 컬럼:**

- E열(5): 키(이름)
- Q열(17): 팀장
- R열(18): 팀장 서명
- O열(15): 고유 시트명 (uniqueName)

## 코딩 규칙

### 필수 규칙

- 함수명, 변수명은 직관적이고 명확하게 작성
- 한글 주석을 적극적으로 사용하여 코드의 맥락, 이유, 목적을 설명
- 상수/설정은 CFG 객체로 분리하여 하드코딩 금지
- 최신 JS 문법(ES6+) 사용: const/let, 템플릿 리터럴, 화살표 함수
- 예외 상황은 반드시 예외처리 (return, throw, try-catch)
- 함수는 단일 책임 원칙을 지키고, 하나의 역할만 수행

### 금지 사항

- 의미 없는 변수명, 축약어, 불명확한 함수명 사용 금지
- 하드코딩된 시트명, 컬럼 인덱스 직접 사용 금지
- 주석 없이 복잡한 로직 작성 금지
- 예외처리 없는 외부 API/시트 접근 금지

## 주요 설정

### OAuth 스코프 (appsscript.json)

```json
{
  "oauthScopes": [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive",
    "https://www.googleapis.com/auth/script.external_request",
    "https://www.googleapis.com/auth/calendar",
    "https://www.googleapis.com/auth/script.deployments"
  ]
}
```

### 환경 설정

- 시간대: Asia/Seoul
- 런타임: V8
- 웹앱 접근: ANYONE_ANONYMOUS

## 개발 팁

### 디버깅

- `console.log()` 대신 Google Apps Script의 실행 로그 사용
- Lock 메커니즘 사용 시 timeout 설정 필수
- PDF 생성 시 권한 확인 필요

### 성능 최적화

- `SpreadsheetApp.flush()` 적절히 사용하여 배치 처리
- 대량 데이터 처리 시 `getValues()`와 `setValues()` 활용
- 파일 검색 시 정확한 패턴 매칭으로 성능 향상

### 보안 고려사항

- OAuth 토큰 사용 시 적절한 스코프 설정
- 외부 API 호출 시 인증 토큰 관리
- 파일 접근 권한 확인 후 처리
