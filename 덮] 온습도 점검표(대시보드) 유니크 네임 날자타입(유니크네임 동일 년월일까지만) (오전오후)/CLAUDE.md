# CLAUDE.md

이 파일은 Claude Code (claude.ai/code)가 이 저장소에서 작업할 때 필요한 가이드를 제공합니다.

## 아키텍처 개요

Google Sheets와 Drive 연동을 사용한 온습도 점검표 대시보드 시스템을 관리하는 Google Apps Script 프로젝트입니다.

### 핵심 구성요소

- **Code.js**: 폼 제출 처리 및 PDF 생성을 위한 메인 애플리케이션 로직
- **appsscript.json**: 필요한 OAuth 범위가 포함된 Google Apps Script 구성 파일
- **최신배포 웹앱 URL.js**: 최신 웹앱 배포 URL을 가져오는 유틸리티 함수

### 시스템 아키텍처

시스템은 Google Sheets 기반 워크플로우로 동작합니다:
1. **폼 제출 처리**: "오전"과 "오후" 제출을 처리
2. **시트 관리**: 사용자와 날짜를 기반으로 고유한 이름의 시트 생성
3. **보드 연동**: 팀장 대시보드로 데이터 전송
4. **PDF 내보내기**: Google Drive에 PDF 보고서 생성 및 저장
5. **전자서명**: 서명 조회 시스템과 연동

### 설정 구조 (CFG 객체)

```javascript
CFG = {
  DATA: 'A시트',           // 메인 데이터 시트
  TEMPLATE: '문서',        // 개인 템플릿 시트
  LOOKUP: 'B시트',         // 이름→대시보드ID 매핑
  MAP_ID: '문서ID',        // 스프레드시트ID→스크립트ID→URL 매핑
  COL: {
    KEY: 5,               // 이름 컬럼 인덱스
    CEO: 14,              // 팀장 컬럼 인덱스
    CEO_SIG: 15,          // 팀장 서명 컬럼 인덱스
  },
  BOARD_ID: {
    manager: '1bZD1_-sf-DqFDlxdc_PHxMD2hiqpglP_nP1zZkg54M4'
  },
  PDF_FOLDER: '1YtKF17v6wi7sVQ0SRT-MIBfwGKFg5tqW'
}
```

## 개발 명령어

Google Apps Script 프로젝트입니다. 개발은 다음을 통해 수행됩니다:
1. **Google Apps Script 편집기**: 코드 편집 및 테스트용
2. **배포**: Google Apps Script 웹앱 배포를 통해
3. **버전 관리**: `updateHubUrlByVersion()` 함수를 사용하여 최신 배포 URL 확인

### 주요 함수

- `onFormSubmit(e)`: 메인 폼 제출 트리거 핸들러
- `doGet(e)`: 서명 처리용 웹앱 진입점
- `getLatestSheet(baseName)`: 가장 최근 시트 버전 찾기
- `pushToBoard(boardId, role, srcRow, url)`: 대시보드 보드로 데이터 전송
- `exportPdfAndNotify(row)`: PDF 생성 및 시트 정리
- `lookupBoardByName(name)`: 사용자 이름을 보드 ID로 매핑
- `insertSig(row, col, name)`: 서명 조회 수식 삽입

## 시트 구조

### 필수 시트
- **A시트**: 메인 데이터 수집 시트 (CFG.DATA)
- **문서**: 개별 보고서용 템플릿 시트 (CFG.TEMPLATE)
- **B시트**: 이름과 대시보드 ID 매핑 (CFG.LOOKUP)
- **문서ID**: 스크립트 ID와 URL 매핑 (CFG.MAP_ID)

### 컬럼 매핑
- 컬럼 1: 타임스탬프
- 컬럼 2: 소유자/사용자 이름
- 컬럼 5: 키 필드 (CFG.COL.KEY)
- 컬럼 14: 팀장 이름 (CFG.COL.CEO)
- 컬럼 15: 팀장 서명 (CFG.COL.CEO_SIG)
- 컬럼 17: 상태 ("오전"/"오후")
- 컬럼 18: 생성된 고유 시트 이름

## 필요한 OAuth 범위

```json
"oauthScopes": [
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/drive", 
  "https://www.googleapis.com/auth/script.external_request",
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/script.deployments"
]
```

## 배포

- `executeAs: "USER_DEPLOYING"` 및 `access: "ANYONE_ANONYMOUS"`로 구성된 웹앱
- 한국 시간대 사용 (`Asia/Seoul`)
- 런타임: V8
- 예외 로깅: STACKDRIVER