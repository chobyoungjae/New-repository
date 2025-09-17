# CLAUDE.md

이 파일은 Claude Code (claude.ai/code)가 이 저장소에서 작업할 때 필요한 가이드라인을 제공합니다.

## 프로젝트 개요

전자서명 휴가신청서 워크플로우 관리를 위한 Google Apps Script 프로젝트입니다. 다단계 서명 프로세스(팀장 → 검토자 → 대표)를 통한 휴가 신청 승인을 처리합니다.

## 아키텍처 개요

### 핵심 구성요소

- **Code.js** - 워크플로우 자동화를 포함한 메인 비즈니스 로직
- **appsscript.json** - 필수 OAuth 스코프가 포함된 Google Apps Script 매니페스트
- **최신배포 웹앱 URL.js** - 최신 배포 URL을 가져오는 유틸리티

### 워크플로우 패턴

1. **양식 제출** → `onFormSubmit(e)` 트리거 실행
2. **개인 시트 생성** → 고유 이름으로 템플릿 복사
3. **역할별 라우팅** → 적절한 보드로 문서 라우팅
4. **승인 체인** → `doGet(e)`로 역할별 승인 처리
5. **최종 처리** → PDF 생성 및 캘린더 연동

### 설정 구조

```javascript
const CFG = {
  DATA: 'A시트',        // 메인 데이터 시트
  TEMPLATE: '문서',      // 문서 템플릿
  LOOKUP: 'B시트',       // 이름-ID 매핑 시트
  MAP_ID: '문서ID',      // 문서-스크립트 매핑
  COL: {                 // 컬럼 인덱스 매핑
    KEY: 5,
    LEADER: 12,
    LEADER_SIG: 13,
    REVIEWER: 14,
    REVIEWER_SIG: 15,
    CEO: 16,
    CEO_SIG: 17,
    UNIQUE_NAME: 21,     // U열: 유니크네임 저장
  },
  BOARD_ID: {
    manager: 'SPREADSHEET_ID'
  },
  PDF_FOLDER: 'FOLDER_ID'
}
```

## 필수 OAuth 스코프

```json
"oauthScopes": [
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/drive",
  "https://www.googleapis.com/auth/script.external_request",
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/script.deployments"
]
```

## 주요 함수들

### 핵심 워크플로우 함수
- `onFormSubmit(e)` - 양식 제출 트리거 핸들러
- `doGet(e)` - 역할별 승인을 위한 웹앱 엔드포인트
- `generateSheetName(row)` - 고유 시트명 생성: `B열_F열_C열_날짜범위(J열)`
- `pushToBoard(boardId, role, row, sheetUrl)` - 보드로 문서 라우팅
- `lookupBoardByName(name)` - 이름을 보드 ID로 매핑

### 서명 처리
- 역할별 승인 핸들러 (팀장, 검토자, 대표)
- PDF 생성 및 저장
- 팀 색상으로 캘린더 이벤트 생성
- U열의 고유 식별자 관리

## 개발 패턴

### 시트명 규칙
형식: `B열_F열_C열_G열~H열(J열)`
- B열: 부서/팀
- F열: 직원명
- C열: 문서 유형
- G~H열: 날짜 범위
- J열: 추가 식별자

### 데이터 관리
- **U열 (21번)**: 항상 참조용 고유 시트명 저장
- **SpreadsheetApp.flush()**: 수식 업데이트 후 필수
- **VLOOKUP 수식**: 이름-보드 매핑에 사용

### URL 생성
- 개인 시트 URL에 `gid` 파라미터 포함
- Google Apps Script API를 통해 웹앱 URL 동적 가져오기
- 룩업 테이블 기반 보드 라우팅

## 테스트 및 배포

### 수동 테스트 과정
1. "실행 권한: 배포하는 사용자"로 웹앱 배포
2. 양식 제출 워크플로우 전체 테스트
3. 역할별 승인 라우팅 확인
4. PDF 생성 및 캘린더 연동 확인

### 배포 명령어
```javascript
// 최신 배포 URL 가져오기
updateHubUrlByVersion()

// 특정 역할 워크플로우 테스트
doGet({parameter: {role: 'leader', row: 2}})
```

## 일반적인 개발 작업

### 새 승인 역할 추가
1. `CFG.COL`에 컬럼 인덱스 추가
2. `doGet(e)`에 역할 핸들러 구현
3. 보드 라우팅 로직 업데이트
4. 서명 컬럼 처리 추가

### 시트 템플릿 수정
1. `CFG.TEMPLATE` 시트에서 템플릿 업데이트
2. 시트 생성 로직의 셀 참조 조정
3. 새 양식 제출로 테스트

### 보드 연동
1. `CFG.BOARD_ID`에 보드 ID 추가
2. `CFG.LOOKUP` 시트의 룩업 테이블 업데이트
3. 역할별 라우팅 로직 구현