# 설정 체크리스트 — 아마존 리뷰 요청 자동화

다음은 `설정가이드.md`를 기반으로 정리한 실제 준비 항목(사전 준비) 체크리스트입니다. 각 항목을 채워 진행하면 다음 단계(앱 등록, 토큰 발급, Apps Script 설정)를 진행할 수 있습니다.

## 1) 필수 계정
- [ ] Amazon Seller Central (Professional)
- [ ] AWS 계정 (IAM 사용자 생성 가능)
- [ ] Google 계정 (Spreadsheet 및 Apps Script 사용)

## 2) 수집할 정보 (복사해서 안전하게 보관)
- LWA Client ID:
- LWA Client Secret:
- LWA Refresh Token:
- AWS Access Key ID:
- AWS Secret Access Key:
- Marketplace ID (예: ATVPDKIKX0DER):
- SP-API Endpoint (예: https://sellingpartnerapi-na.amazon.com):
- AWS Region (예: us-east-1):

※ 민감 정보는 절대 이 저장소(리포지토리)에 커밋하지 마세요. Script Properties 또는 안전한 비밀 저장소에만 보관하세요.

## 3) Script Properties에 넣을 키(Apps Script에서 설정)
- LWA_CLIENT_ID
- LWA_CLIENT_SECRET
- LWA_REFRESH_TOKEN
- AWS_ACCESS_KEY_ID
- AWS_SECRET_ACCESS_KEY
- AWS_REGION
- MARKETPLACE_ID
- SP_API_ENDPOINT

## 4) Apps Script UI에서 Script Properties 설정 방법
1. Google Spreadsheet 열기 → 상단 '확장 프로그램' → 'Apps Script' 클릭
2. Apps Script 에디터에서 오른쪽 상단의 ⚙️(프로젝트 설정) 클릭
3. '스크립트 속성(Script properties)' 섹션을 찾고, '스크립트 속성 추가' 클릭
4. 위의 키 이름을 정확히 입력하고 해당 값을 붙여넣기
5. 모든 키를 추가한 후 저장

확인 방법: 스프레드시트로 돌아가 상단 메뉴에서 '🔄 리뷰 요청' → '⚙️ 설정 확인' 클릭. 상태 창에서 모든 설정이 완료되었다는 메시지가 뜨면 성공입니다.

## 5) 간단 점검 목록
- [ ] `Code.js`의 `CONFIG.PROPS` 키 목록과 Script Properties 키가 일치하는가?
- [ ] `appsscript.json`의 OAuth 스코프(스프레드시트, 외부 요청)가 적절한가?
- [ ] 스프레드시트에 `아마존 리뷰 요청 관리` 또는 지정한 시트가 생성되었는가?

## 6) 다음 단계 (권장)
- Amazon Developer Central에서 앱 등록 (LWA Client ID/Secret 확보)
- AWS IAM에서 프로그램 접근용 사용자 생성 (Access Key/Secret 확보)
- OAuth 인증 플로우로 Refresh Token 발급

---
작성자 도구: 자동 생성
