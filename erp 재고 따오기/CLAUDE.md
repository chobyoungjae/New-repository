# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 프로젝트 개요
이 프로젝트는 Google Apps Script를 사용하여 Ecount ERP 시스템과 API 통신을 통해 재고 데이터를 가져와 Google Sheets에 저장하는 자동화 시스템입니다.

## 핵심 아키텍처
- **Google Apps Script 환경**: `appsscript.json`에서 타임존과 런타임 설정
- **ERP API 인증**: 세션 ID 기반 인증 시스템
- **에러 처리**: 카카오톡 메시지 + 이메일 알림 시스템
- **자동화**: 정기 트리거를 통한 스케줄링

## 주요 파일 역할
- `재고조회 최종.js`: 메인 재고 조회 로직, 에러 처리, 알림 시스템
- `세션ID 발급용.js`: ERP 시스템 로그인 및 세션 획득
- `품목등록.js`: ERP 품목 목록 조회 및 등록 기능
- `테스트 api 검증용.js`: API 테스트 및 검증용 코드

## 인증 정보
- Ecount ERP API 인증키는 코드에 하드코딩됨
- 회사 코드: `606274`
- 사용자 ID: `OOSDREAM`
- API 엔드포인트: `https://oapicb.ecount.com/OAPI/V2/`

## 핵심 함수
- `loginToEcountWithOfficialKey()`: ERP 로그인 및 세션 ID 획득
- `importInventoryListFromEcount()`: 전체 재고 조회 및 Google Sheets 업데이트
- `runImportInventory()`: 메인 실행 함수 (트리거 진입점)
- `sendErrorAlert()`: 카카오톡/이메일 에러 알림

## 데이터 흐름
1. 세션 ID 발급 (ERP 로그인)
2. 위치별 재고 조회 (위치 코드: '00001', '00004')
3. 각 품목의 제품명 조회
4. Google Sheets '재고현황' 시트에 데이터 저장
5. 에러 발생 시 C1 셀에 에러 메시지 기록 및 알림 발송

## 에러 처리
- API 호출 실패 시 `muteHttpExceptions: true` 사용
- 에러 발생 시 카카오톡 메시지 + 이메일 자동 발송
- 시트의 C1 셀을 에러 상태 표시용으로 사용
- 에러 없을 때만 대시보드에 실행 로그 기록

## 개발 시 주의사항
- 코드에 하드코딩된 인증 정보 변경 시 주의
- API 응답 구조 변경 시 파싱 로직 수정 필요
- 에러 알림 토큰 관리 (카카오톡 토큰은 스프레드시트에서 읽음)
- 위치 코드 변경 시 `locationCodes` 배열 수정