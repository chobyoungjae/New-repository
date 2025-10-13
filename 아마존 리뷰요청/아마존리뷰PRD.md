📄 PRD 문서: Amazon SP-API 기반 리뷰 요청 자동화 시스템
1. 개요

아마존 셀러 계정의 주문 중 배송 후 5일~30일 사이의 주문에 대해,
셀러센트럴에서 제공하는 "리뷰요청" 버튼과 동일한 동작을 SP-API(Selling Partner API) Solicitations 엔드포인트를 통해 자동화한다.
이 과정은 Google Apps Script(GAS)를 이용해 Google Spreadsheet와 연동되며, 매일 1회 자동 실행된다.

2. 목표

자동화: 리뷰 요청 버튼 클릭 과정을 API 기반으로 자동 처리

효율화: 하루 1회만 신규 주문 데이터만 가져와 시트에 Append

추적 가능성: 요청 여부, 요청 시각, 응답 메시지 등을 스프레드시트에 기록

안전성: 아마존 공식 API를 사용하여 규정 위반 없이 진행

3. 요구사항
기능적 요구사항

Orders API를 통해 신규 주문만 조회 (LastUpdatedAfter 활용)

FBA(AFN) 주문만 필터링

배송일(EarliestDeliveryDate, LatestDeliveryDate) 기준으로 5~30일 범위에 속하는 주문만 선별

Solicitations API getSolicitationActionsForOrder로 요청 가능 여부 확인

요청 가능 시 createProductReviewAndSellerFeedbackSolicitation 호출

결과를 Google Spreadsheet에 Append

스프레드시트는 기존 데이터 유지, 신규 데이터만 누적

실행 결과 및 오류 메시지 기록

비기능적 요구사항

실행 빈도: 하루 1회 (예: 오전 10시)

인증:

LWA(Client ID, Secret, Refresh Token) 기반 Access Token 발급

AWS SigV4 서명 필수

보안:

키값은 코드에 하드코딩하지 않고 Script Properties에 저장

안정성:

429 (Rate Limit) 발생 시 지수적 백오프 재시도

API 호출 실패 시 로그 및 오류 메시지 시트 기록

4. 시스템 흐름

트리거 실행 (매일 오전 10시)

Script Properties에서 마지막 실행 시각 불러오기

Orders API 호출 (LastUpdatedAfter=마지막 실행 시각)

신규 주문 → FBA 주문 → 배송일 5~30일 범위 필터

주문별 Solicitations API 호출: 요청 가능 여부 확인

가능 시 리뷰 요청 발송

결과(성공/실패/이미요청) + 응답메시지 기록

실행 완료 후 현재 시각을 Script Properties에 저장

5. 데이터 모델 (Google Spreadsheet 구조)
컬럼	설명
A: No	자동 증가 번호
B: AmazonOrderId	아마존 주문 ID
C: SellerOrderId	셀러 주문 ID
D: 주문 요약	주문 총액(통화/금액)
E: ASIN	상품 ASIN
F: SKU	셀러 SKU
G: FulfillmentChannel	AFN(FBA) 여부
H: EarliestDeliveryDate	배송 시작일
I: LatestDeliveryDate	배송 완료일
J: 리뷰요청 가능여부	Y/N
K: 리뷰요청 상태	대기/성공/실패/이미요청
L: 리뷰요청일시	요청 실행 시각
M: 응답메시지/에러	API 반환 메시지
N: ASIN 리뷰페이지 URL	https://amazon.com/product-reviews/{ASIN}

O: 메모	비고란
6. 예외 처리

중복 요청 방지: 주문당 1회만 요청 (이미 요청된 주문은 Append 시 “이미요청” 상태 기록)

API Rate Limit 초과: 429 발생 시 1초, 2초, 4초 지수 백오프 후 재시도 (최대 3회)

API 실패(5xx): 재시도 후 실패 시 “실패” 상태와 응답 코드 기록

리뷰 요청 불가 상태: 요청 가능 여부 조회 시 액션 없음 → “N”으로 기록

7. 배포 및 운영

개발자 준비물

LWA Client ID, Secret, Refresh Token (Seller Central Developer Central 발급)

AWS Access Key, Secret (IAM 발급)

Endpoint URL + MarketplaceId

구현 환경: Google Apps Script (시트에 부착)

보안: 모든 키는 Script Properties에 저장

운영

시간 기반 트리거(매일 오전 10시)

수동 실행 버튼 제공(onOpen 메뉴)

스프레드시트 자체가 실행 로그 역할

8. 확장 고려사항

리뷰 현황 조회: 현재 SP-API는 개별 리뷰 텍스트/URL 제공하지 않음 → 차후 Customer Reviews API 집계 데이터 활용 가능