# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 프로젝트 개요

Google Apps Script를 사용한 원재료 발주 관리 시스템입니다. 스프레드시트와 Google 캘린더를 연동하여 발주 내역을 자동으로 관리합니다.

## 배포 명령어

```bash
# Google Apps Script로 코드 푸시
clasp push

# 스크립트 에디터 열기
clasp open
```

- Script ID: `1QbMtojeCjBe67zQxxrtccQQ38WDiRpawhHr7juSc710q6NAp-84DWVkQ`
- 메인 스프레드시트 ID: `1FAYigya47GJWfTm4yysQSY9WCTDV8b0Du_rYnAtYug0`

## 핵심 스크립트 파일

| 파일 | 트리거 | 역할 |
|------|--------|------|
| `구매캘린더로 전송.js` | onEdit | N열="발주완료" 시 구매 캘린더 시트로 이동 |
| `담당자변경.js` | onFormSubmit | QR 스캔 → 설문 제출 → 구역별 담당자 일괄 변경 |
| `스프레드시트_to_캘린더.js` | 수동/시간 | 스프레드시트 → Google 캘린더 동기화 |
| `캘린더_to_스프레드시트.js` | 수동/시간 | Google 캘린더 → 스프레드시트 역동기화 |
| `카톡 메시지 보내기.js` | onEdit | 발주확인/완료 시 카카오톡 알림 |

## 스프레드시트 구조

| 시트명 | 용도 |
|--------|------|
| 부재료(박스) | 박스류 발주 관리 |
| 부재료(포장지) | 포장지류 발주 관리 |
| 원재료 | 원재료 발주 관리 |
| 구매 캘린더 | 발주완료 데이터 집계 |
| 해당거래처 | 거래처 정보 (B열=코드, I열=담당자, K열=결제조건, L열=구역) |
| 배합실/컵떡장/외포장실 담당자 | QR 설문 응답 시트 |

## 트리거 구조

두 개의 독립적인 트리거가 동시에 운영됨:
- **onEdit**: `moveToBuyCalendar()` - 셀 수정 감지 (발주완료)
- **onFormSubmit**: `onFormSubmitUpdateManager()` - 폼 제출 감지 (담당자변경)

## 주요 설정값

```javascript
// 캘린더 ID
const CALENDAR_ID = 'u37tatg5kaj7q6eru6m2o9vr80@group.calendar.google.com';

// 색상 매핑 (Google 캘린더 API)
const colorMap = { 파랑: 1, 초록: 2, 보라: 3, 핑크: 4, 노랑: 5, 청록: 6, 회색: 8, 빨강: 11 };

// 담당자변경 시스템 구역 매핑
const ZONE_CONFIG = {
  '배합실 담당자': '배합실',
  '컵떡장 담당자': '컵떡장',
  '외포장실 담당자': '외포장실'
};
```

## 알려진 이슈

- 연속 3-4개 행을 빠르게 "발주완료" 변경 시 일부 누락 가능 (동시성 문제)
- `LockService` 사용 중이나 완전한 해결은 아님

## 개발 시 주의사항

- 타임존: `Asia/Seoul` 고정
- 트리거 함수 수정 시 Apps Script 에디터에서 트리거 재설정 필요
- 열 번호가 하드코딩되어 있으므로 스프레드시트 구조 변경 시 주의