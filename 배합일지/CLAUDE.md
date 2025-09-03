# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 프로젝트 개요

배합일지 - 완전 자동화된 생산 배합 ERP 연동 시스템입니다. Google Sheets 데이터를 ERP 형식으로 변환하고, 웹훅을 통해 로컬 VBA 스크립트를 트리거하여 이카운트 ERP 시스템에 자동으로 업로드하는 통합 워크플로우를 제공합니다.

## 시스템 아키텍처

### 통합 자동화 워크플로우
```
Google Sheets (클라우드)
    ↓ 1. 데이터 필터링/변환
뷰 시트 → ERP 시트
    ↓ 2. 웹훅 트리거
Python 서버 (localhost:5000)
    ↓ 3. VBA 스크립트 실행
Excel 자동화 → 이카운트 ERP
```

### 구성 요소

#### Google Apps Script (클라우드)
- **Code.js**: 메인 워크플로우 제어 및 웹훅 발송
- **DataTransformer.js**: 뷰 시트 8개 테이블을 ERP 형식으로 변환

#### Python 웹훅 서버 (로컬)
- **webhook_server.py**: Flask 서버로 웹훅 수신 및 VBA 실행 관리
- 포트 5000에서 실행, 로깅 및 상태 모니터링 기능

#### VBA 자동화 (로컬)
- **ICountAutomation_*.vba**: Excel VBA를 통한 이카운트 ERP 시스템 연동
- **trigger_icount_upload.vbs**: Python에서 VBA 실행을 위한 트리거 스크립트

### 시트 구성
- **시트1**: 타임스탬프와 생산 기록이 저장된 메인 데이터 시트
- **뷰**: 8개 테이블(2x4 격자)로 구성된 필터링된 데이터 뷰
- **ERP**: 행 단위로 변환된 최종 ERP 업로드용 데이터

## 핵심 기능

### 1. 타임스탬프 필터링 (`moveTimestamps()`)
- 시트1 A열에서 오늘 날짜 타임스탬프 추출
- 한국식 날짜 형식 "YYYY.MM.DD" 및 Date 객체 지원
- 뷰 시트 B1:B11에 최대 11개 기록 이동

### 2. 데이터 변환 (`transformViewToERP()`)
- 뷰 시트 8개 테이블(2x4 격자)을 ERP 행 형식으로 변환
- 각 테이블별 헤더 정보(타임스탬프, 코드, 세부정보, 총액) 반복 입력
- 품목 데이터(코드, 명, 수량, 단가)를 연속적으로 배치
- YYYYMMDD 형식으로 타임스탬프 변환

### 3. 웹훅 연동 (`sendWebhookTrigger()`)
- localhost:5000 Python 서버로 웹훅 발송
- VBA 스크립트 자동 실행 트리거
- 연결 실패 시 사용자 안내 및 대체 플로우

### 4. REST API (`doGet()`)
- VBA에서 ERP 데이터를 가져올 수 있는 API 제공
- 액션: `get_erp_data`, `health_check`
- 이카운트 형식으로 데이터 변환 및 반환

## 실행 워크플로우

### 자동화 체인
1. **사용자 액션**: "생산뷰" → "타임스템프 이동" 클릭
2. **Apps Script**: `moveTimestamps()` → `transformViewToERP()` → `sendWebhookTrigger()`
3. **Python 서버**: 웹훅 수신 → VBA 스크립트 실행
4. **VBA**: Google Sheets API 호출 → Excel 업데이트 → 이카운트 업로드
5. **결과**: 완전 자동화된 ERP 데이터 연동

### 로컬 서버 실행
```bash
cd "Y:\4000_생산(조병재)\2025년\ERP 생산등록2 자동"
python webhook_server.py
```

## 데이터 매핑

### 뷰 시트 테이블 위치 (8개)
- 테이블 1-4: 행 12-37 (A12, G12, M12, S12)
- 테이블 5-8: 행 39-64 (A39, G39, M39, S39)

### ERP 시트 열 매핑
- A열: 타임스탬프 (YYYYMMDD)
- D열: 담당자 (미쓰리)
- E열: 창고 (불출창고)
- I열: 업체코드
- J열: 세부정보
- M열: 총액
- Q열: 품목코드
- R열: 품목명
- T열: 수량
- W열: 단가

## 개발 설정

### Google Apps Script
- 시간대: Asia/Seoul
- 런타임: V8
- 예외 로깅: STACKDRIVER

### Python 서버 요구사항
- Flask 프레임워크
- UTF-8 로깅 (webhook.log)
- 5분 VBA 실행 타임아웃
- Windows CP949 인코딩 지원

### VBA 설정 요구사항
- Excel 매크로 보안 설정 허용
- Google Apps Script ID 구성 필요
- Y:\ 드라이브 네트워크 경로 접근 권한