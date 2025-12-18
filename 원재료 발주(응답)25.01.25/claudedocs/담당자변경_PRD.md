# PRD: 구역별 담당자 자동 변경 시스템

## 1. 프로젝트 개요

### 1.1 목적
Google Forms + Apps Script를 활용하여 생산 구역별 담당자를 QR 코드 스캔 한 번으로 자동 변경하는 시스템 구축

### 1.2 대상 구역
| 구역 | 설문지 | 응답 시트 |
|------|--------|-----------|
| 배합실 | [링크](https://docs.google.com/forms/d/e/1FAIpQLSeVSmay-w5J-4pBih-WYwdKmcrwrn2D2pUi-y3FQdlc35Th9w/viewform) | 배합실 담당자 |
| 컵떡장 | [링크](https://docs.google.com/forms/d/e/1FAIpQLScK5xB8fG6bqW-TgdH29PeQ1FMhIG4Way0ojzdAn7v9P3DAkg/viewform) | 컵떡장 담당자 |
| 외포장실 | [링크](https://docs.google.com/forms/d/e/1FAIpQLSce70SXzxbK5VS65Dn3znxCz3SaIqKZ_X16SrIGY3798vXoBQ/viewform) | 외포장실 담당자 |

### 1.3 메인 스프레드시트
- **ID**: `1FAYigya47GJWfTm4yysQSY9WCTDV8b0Du_rYnAtYug0`
- **대상 시트**: `해당거래처`
  - L열: 작업 구역명
  - I열: 담당자명 (변경 대상)

---

## 2. 사용자 흐름

```
[현장 QR 스캔] → [구역별 설문지 열림] → [담당자 선택] → [제출]
                                                           ↓
[해당거래처 시트] ← [Apps Script 실행] ← [응답 시트 기록]
   (L열=구역인 행의 I열 일괄 변경)
```

---

## 3. 기술 요구사항

### 3.1 Apps Script 함수

#### 메인 트리거 함수
```javascript
/**
 * 설문 제출 시 자동 실행
 * @param {GoogleAppsScript.Events.FormsOnFormSubmit} e - 폼 제출 이벤트
 */
function onFormSubmitUpdateManager(e) {
  // 1. 제출된 시트명으로 구역 식별
  // 2. 응답에서 담당자명 추출
  // 3. 해당거래처 시트에서 L열 == 구역인 행의 I열 변경
}
```

#### 핵심 로직
| 단계 | 동작 | 비고 |
|------|------|------|
| 1 | 이벤트 소스(시트명) 확인 | `배합실 담당자`, `컵떡장 담당자`, `외포장실 담당자` |
| 2 | 시트명 → 구역명 매핑 | `배합실 담당자` → `배합실` |
| 3 | 응답 데이터에서 담당자명 추출 | 2번째 열 (A=타임스탬프, B=담당자) |
| 4 | `해당거래처` 시트 L열 순회 | L열 값 == 구역명 확인 |
| 5 | 조건 충족 행의 I열 값 변경 | 담당자명으로 업데이트 |

### 3.2 트리거 설정
- **유형**: `onFormSubmit`
- **범위**: 스프레드시트 (3개 설문지 응답 통합)
- **실행 주체**: 스크립트 소유자

### 3.3 에러 처리
- 구역 매핑 실패 시 로그 기록 후 종료
- 담당자명 없을 시 변경 스킵
- 해당거래처 시트 없을 시 에러 알림

---

## 4. 데이터 구조

### 4.1 설문 응답 시트 (구역별)
| 열 | 내용 |
|----|------|
| A | 타임스탬프 |
| B | 담당자 이름 |

### 4.2 해당거래처 시트
| 열 | 내용 | 용도 |
|----|------|------|
| I | 담당자명 | **변경 대상** |
| L | 작업 구역 | 필터 조건 |

### 4.3 구역-시트 매핑
```javascript
const ZONE_MAP = {
  '배합실 담당자': '배합실',
  '컵떡장 담당자': '컵떡장',
  '외포장실 담당자': '외포장실'
};
```

---

## 5. QR 코드 생성

### 5.1 생성 대상
| 구역 | URL |
|------|-----|
| 배합실 | `https://docs.google.com/forms/d/e/1FAIpQLSeVSmay-w5J-4pBih-WYwdKmcrwrn2D2pUi-y3FQdlc35Th9w/viewform` |
| 컵떡장 | `https://docs.google.com/forms/d/e/1FAIpQLScK5xB8fG6bqW-TgdH29PeQ1FMhIG4Way0ojzdAn7v9P3DAkg/viewform` |
| 외포장실 | `https://docs.google.com/forms/d/e/1FAIpQLSce70SXzxbK5VS65Dn3znxCz3SaIqKZ_X16SrIGY3798vXoBQ/viewform` |

### 5.2 QR 생성 방식
- Google Charts API 또는 외부 QR 생성기 활용
- PNG 형식, 300x300px 이상
- 라벨 포함 (구역명 표시)

---

## 6. 구현 범위

### Phase 1: 핵심 기능 (필수)
- [ ] `onFormSubmitUpdateManager()` 함수 작성
- [ ] 구역-시트 매핑 로직
- [ ] 해당거래처 시트 일괄 변경 로직
- [ ] 트리거 설정

### Phase 2: 부가 기능 (선택)
- [ ] 변경 로그 기록 (별도 시트)
- [ ] 에러 발생 시 이메일/카톡 알림
- [ ] QR 코드 이미지 생성 스크립트

---

## 7. 테스트 시나리오

| # | 시나리오 | 예상 결과 |
|---|----------|-----------|
| 1 | 배합실 설문 제출 (담당자: 홍길동) | 해당거래처 L열="배합실"인 모든 행의 I열 → "홍길동" |
| 2 | 컵떡장 설문 제출 (담당자: 김철수) | 해당거래처 L열="컵떡장"인 모든 행의 I열 → "김철수" |
| 3 | 외포장실 설문 제출 (담당자: 이영희) | 해당거래처 L열="외포장실"인 모든 행의 I열 → "이영희" |
| 4 | 잘못된 시트에서 트리거 발생 | 로그만 기록, 변경 없음 |

---

## 8. 기존 코드와의 충돌 분석

### ✅ 충돌 없음 확인

| 구분 | 기존 코드 | 신규 코드 |
|------|-----------|-----------|
| **트리거 유형** | `onEdit` (셀 수정) | `onFormSubmit` (폼 제출) |
| **대상 시트** | 부재료(박스), 부재료(포장지), 원재료 | 배합실 담당자, 컵떡장 담당자, 외포장실 담당자 |
| **변경 시트** | 구매 캘린더 | 해당거래처 |
| **변경 열** | L열 (체크박스 추가) | I열 (담당자명 변경) |
| **읽기 열** | 해당거래처 B열, K열 | 해당거래처 L열 |

### 기존 함수 목록 (충돌 없음)
- `moveToBuyCalendar()` - 발주완료 시 구매 캘린더로 이동
- `onEdit()` - 발주확인/완료 시 카톡 메시지 전송
- `updateBuyCalendar()` - 스프레드시트 → 캘린더 동기화
- `updateCalendarToSheet()` - 캘린더 → 스프레드시트 동기화

---

## 9. 파일 구조

```
원재료 발주(응답)25.01.25/
├── Code.js                    # 기존 메인 코드 (없음)
├── 구매캘린더로 전송.js         # 기존 발주 완료 처리
├── 스프레드시트_to_캘린더.js     # 기존 캘린더 동기화
├── 캘린더_to_스프레드시트.js     # 기존 역동기화
├── 카톡 메시지 보내기.js        # 기존 카톡 알림
├── 담당자변경.js               # 🆕 신규 추가
├── claudedocs/
│   └── 담당자변경_PRD.md       # 🆕 본 문서
└── appsscript.json            # 매니페스트
```

---

## 10. 제약사항

- Apps Script 실행 시간 제한: 6분
- 동시 실행 시 Lock Service 고려 필요
- 스프레드시트 셀 수정 할당량: 일일 제한 존재

---

## 11. 트리거 설정 가이드

### 11.1 Google Apps Script 에디터에서 트리거 추가

1. **스프레드시트 열기**
   - `https://docs.google.com/spreadsheets/d/1FAYigya47GJWfTm4yysQSY9WCTDV8b0Du_rYnAtYug0/edit`

2. **Apps Script 에디터 열기**
   - 메뉴: `확장 프로그램` → `Apps Script`

3. **담당자변경.js 코드 추가**
   - 새 파일 생성 또는 기존 파일에 코드 붙여넣기

4. **트리거 설정**
   - 좌측 메뉴: `트리거` (시계 아이콘) 클릭
   - `+ 트리거 추가` 버튼 클릭
   - 설정:
     - 실행할 함수: `onFormSubmitUpdateManager`
     - 배포: `Head`
     - 이벤트 소스: `스프레드시트에서`
     - 이벤트 유형: `양식 제출 시`
   - `저장` 클릭

5. **권한 승인**
   - 첫 실행 시 Google 계정 권한 승인 필요

### 11.2 테스트 방법

1. `testUpdateManager()` 함수 실행하여 기본 동작 확인
2. `checkManagerStatus()` 함수로 현황 조회
3. 실제 설문지 제출하여 자동 변경 확인

---

## 12. QR 코드 생성

### 12.1 Google Charts API 사용 (즉시 생성)

아래 URL을 브라우저에서 열면 QR 코드 이미지가 생성됩니다:

**배합실**
```
https://chart.googleapis.com/chart?chs=300x300&cht=qr&chl=https://docs.google.com/forms/d/e/1FAIpQLSeVSmay-w5J-4pBih-WYwdKmcrwrn2D2pUi-y3FQdlc35Th9w/viewform
```

**컵떡장**
```
https://chart.googleapis.com/chart?chs=300x300&cht=qr&chl=https://docs.google.com/forms/d/e/1FAIpQLScK5xB8fG6bqW-TgdH29PeQ1FMhIG4Way0ojzdAn7v9P3DAkg/viewform
```

**외포장실**
```
https://chart.googleapis.com/chart?chs=300x300&cht=qr&chl=https://docs.google.com/forms/d/e/1FAIpQLSce70SXzxbK5VS65Dn3znxCz3SaIqKZ_X16SrIGY3798vXoBQ/viewform
```

### 12.2 저장 방법
1. 위 URL을 브라우저에서 열기
2. 이미지 우클릭 → `이미지를 다른 이름으로 저장`
3. 파일명: `QR_배합실.png`, `QR_컵떡장.png`, `QR_외포장실.png`

---

## 13. 구현 완료 체크리스트

- [x] PRD 문서 작성 (`claudedocs/담당자변경_PRD.md`)
- [x] 핵심 코드 작성 (`담당자변경.js`)
- [x] 기존 코드 충돌 분석 완료
- [ ] 트리거 설정 (수동)
- [ ] 실제 테스트 수행
- [ ] QR 코드 출력 및 현장 부착
