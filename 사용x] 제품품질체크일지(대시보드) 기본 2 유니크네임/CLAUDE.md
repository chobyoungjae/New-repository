# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 프로젝트 개요

Google Apps Script 기반의 제품품질체크일지 대시보드 시스템입니다. Google Sheets를 통해 문서 워크플로와 서명 프로세스를 관리하는 품질관리 시스템입니다.

## 필수 명령어

Google Apps Script 프로젝트이므로 Google Apps Script IDE를 통해 배포합니다:

1. **웹앱 배포**: 배포 → 새 배포 → 유형: 웹앱 → 실행자: 나 → 액세스: 모든 사용자
2. **함수 테스트**: Apps Script IDE에서 `testExportPdf40()` 같은 개별 함수 실행
3. **로그 확인**: Apps Script IDE에서 실행 로그 확인

## 시스템 아키텍처

### 핵심 구성요소

**설정 시스템 (`CFG` 객체 2-19줄)**
- `DATA`: 메인 데이터 시트 ('A시트')
- `TEMPLATE`: 문서 템플릿 시트 ('문서') 
- `LOOKUP`: 이름-보드ID 매핑 시트 ('B시트')
- `MAP_ID`: 스크립트ID-URL 매핑 시트 ('문서ID')
- 구조화된 데이터 접근을 위한 컬럼 인덱스 매핑
- 승인 라우팅을 위한 보드 ID 설정

**문서 워크플로 프로세스**
1. **폼 제출** (`onFormSubmit()` 33-115줄): 템플릿에서 고유한 개인 시트 생성, 폼 데이터 추출, `주문자_제품명_유통기한_로트_중량` 형식으로 고유 시트명 생성
2. **이미지 통합** (65-94줄): Google Drive URL에서 이미지를 가져와 특정 시트 셀에 삽입
3. **팀장 배정** (101-114줄): B시트를 통해 VLOOKUP으로 제출자를 팀장에게 매핑
4. **보드 라우팅** (`pushToBoard()` 170-203줄): IMPORTRANGE 수식으로 해당 승인 보드에 항목 전송

**서명 시스템 (`doGet()` 118-132줄)**
- 서명 처리를 위한 웹앱 진입점
- VLOOKUP 수식을 사용한 역할 기반 서명 삽입
- 서명 완료 후 자동 PDF 생성

**PDF 생성 (`exportPdfAndNotify()` 206-254줄)**
- 특정 서식으로 개별 시트를 PDF로 내보내기
- 지정된 Google Drive 폴더에 업로드
- 성공적인 PDF 생성 후 임시 시트 정리
- 동시 실행 방지를 위한 스크립트 락 사용

### 데이터 플로우 구조

```
폼 제출 → 고유 시트 생성 → 이미지 삽입 → 팀장 매핑 → 보드 라우팅
                                                        ↓
PDF 생성 ← 서명 처리 ← 웹앱 진입점 ← 보드 승인
```

### 주요 네이밍 규칙

**시트명 패턴**: `${주문자}_${제품명}_${유통기한}_${로트}_${중량}` 형식, 중복 시 `(1)`, `(2)` 자동 추가

**컬럼 매핑**:
- 5열 (E): 키/이름 필드
- 34열 (AH): 팀장 배정  
- 35열 (AI): 팀장 서명
- 46열 (AT): 고유 시트명 저장

### Google Drive 통합

**이미지 처리**: Drive URL에서 파일 ID를 추출하고 OAuth 인증된 썸네일 요청을 사용해 이미지 삽입

**PDF 저장**: 완성된 문서를 타임스탬프 기반 네이밍으로 지정된 Drive 폴더에 내보내기

### 보안 및 권한

**필수 OAuth 스코프**:
- `spreadsheets`: 시트 조작 및 데이터 접근
- `drive`: 파일 작업 및 PDF 저장
- `script.external_request`: 이미지 삽입용 API 호출
- `calendar`: 일정 통합 기능
- `script.deployments`: 웹앱 URL 조회

**접근 제어**: 외부 폼 처리를 위해 익명 액세스(`ANYONE_ANONYMOUS`)로 웹앱 설정

### 유틸리티 함수

**URL 처리**: `extractId()` 함수로 Google Drive URL을 파싱하여 API 작업용 파일 ID 추출

**동적 URL 해결**: `lookupExecUrlByScriptId()`로 스크립트 ID를 배포 URL에 매핑하여 크로스 스크립트 통신

**보드 조회**: `lookupBoardByName()`으로 팀장명을 해당 보드 ID로 해결하여 라우팅

## 개발 참고사항

- 한국 시간대(Asia/Seoul)와 V8 런타임 사용
- 이미지 삽입 작업에 적절한 오류 처리 구현
- 종속 작업 전 수식 계산 완료를 위해 `SpreadsheetApp.flush()` 사용
- 데이터 무결성 유지를 위해 성공적인 PDF 생성 후에만 시트 삭제