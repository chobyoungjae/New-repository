/**
 * 카카오 토큰 매니저 (수정 버전)
 * - "토큰갱신" 시트에 Access / Refresh 토큰 저장
 * - 주기적으로 토큰을 갱신하고 남은 유효기간(일)을 기록
 * - 최초 로그인 시 "가입 완료" 상태를 보장해 자동 언링크를 방지
 * 작성일: 2025‑05‑12
 */

// === 환경설정 ===
const REST_API_KEY = 'b753d319ccd4300a4c957d7d4c6c9b96'; // 카카오 REST API 키

// === 메인 트리거 함수 ===
function refreshTokensAndUpdateFriends() {
  logRegularTriggerMapped('refreshTokensAndUpdateFriends');

  // 1) 모든 사용자 토큰 갱신 및 TTL 기록
  refreshAllTokens();

  // 2) 토큰이 최신 상태가 된 직후 친구 목록 갱신
  getKakaoFriendsToSheet();

  // 3) 갱신 실패 사용자 알림 (메일·시트 등)
  notifyTokenRefreshFailures();

  // 4) TTL 칼럼 빈칸 정리 (추가 API 호출 없이 ‘-’로 표시)
  updateRefreshTokenTTL();
}

// === 로그인 콜백 (POST) ===
function doPost(e) {
  // x‑www‑form‑urlencoded 또는 JSON 모두 처리
  const p = (e.parameter && Object.keys(e.parameter).length)
    ? e.parameter
    : JSON.parse(e.postData.contents || '{}');

  const name         = p.state;         // 로그인 페이지에서 넘긴 사용자 이름
  const accessToken  = p.access_token;  // 카카오에서 받은 Access Token
  const refreshToken = p.refresh_token; // 카카오에서 받은 Refresh Token

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName('토큰갱신');
  if (!sh) throw new Error("'토큰갱신' 시트를 찾을 수 없습니다");

  // 헤더가 없으면 생성 (A1:C1)
  const hdr = sh.getRange('A1:C1').getValues()[0];
  if (hdr[0] !== 'Name' || hdr[1] !== 'Access Token' || hdr[2] !== 'Refresh Token') {
    sh.clear();
    sh.getRange('A1:C1').setValues([['Name','Access Token','Refresh Token']]);
  }

  // 사용자 행 삽입 또는 업데이트
  const lastRow = sh.getLastRow();
  const names   = lastRow > 1 ? sh.getRange(2, 1, lastRow - 1, 1).getValues().flat() : [];
  let row;
  const idx = names.indexOf(name);
  if (idx >= 0) {
    // 기존 사용자 → 토큰만 갱신
    row = idx + 2;
    sh.getRange(row, 2, 1, 2).setValues([[accessToken, refreshToken]]);
  } else {
    // 신규 사용자 → 행 추가
    row = sh.appendRow([name, accessToken, refreshToken]).getRow();
  }

  // 발급 시각 기록 (E열)
  const ts = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
  sh.getRange(row, 5).setValue(ts);

  // ★ [중요] 개인정보 API 1회 호출로 "가입 완료" 처리 → 자동 언링크 방지
  try {
    UrlFetchApp.fetch('https://kapi.kakao.com/v2/user/me', {
      headers: { Authorization: 'Bearer ' + accessToken },
      muteHttpExceptions: true
    });
  } catch (_) {}

  return ContentService.createTextOutput('ok');
}

// === 전체 사용자 토큰 갱신 ===
function refreshAllTokens() {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('토큰갱신');
  if (!sh) throw new Error("'토큰갱신' 시트를 찾을 수 없습니다");

  const rows = sh.getLastRow() - 1;
  if (rows < 1) return;               // 사용자 없음

  const data = sh.getRange(2, 1, rows, 3).getValues(); // [Name, Access, Refresh]
  const tz   = Session.getScriptTimeZone();

  data.forEach((row, i) => {
    const refresh = row[2];
    const r = i + 2;                 // 실제 시트 행 번호

    // Refresh 토큰이 없으면 스킵
    if (!refresh) {
      sh.getRange(r, 6).setValue('갱신불가: 토큰없음');
      return;
    }

    // 토큰 갱신 요청
    const resp = UrlFetchApp.fetch('https://kauth.kakao.com/oauth/token', {
      method : 'post',
      payload: {
        grant_type:    'refresh_token',
        client_id:     REST_API_KEY,
        refresh_token: refresh
      },
      muteHttpExceptions: true
    });

    let json = {};
    try { json = JSON.parse(resp.getContentText()); } catch(_) {}

    // ── 실패 처리 ─────────────────────────────────
    if (resp.getResponseCode() !== 200 || json.error) {
      sh.getRange(r, 6).setValue(`ERROR: ${json.error || resp.getResponseCode()}`);
      return; // 다음 사용자로
    }

    // ── 성공 시: Access / Refresh 토큰 저장 ─────────
    if (json.access_token)  sh.getRange(r, 2).setValue(json.access_token);
    if (json.refresh_token) sh.getRange(r, 3).setValue(json.refresh_token);

    // 남은 TTL(초)을 일 단위로 변환 후 D열 저장
    if (json.refresh_token_expires_in !== undefined) {
      const days = Math.ceil(json.refresh_token_expires_in / 86400);
      sh.getRange(r, 4).setValue(days + '일');
    }

    // 상태·타임스탬프 기록
    sh.getRange(r, 6).setValue('갱신완료');
    sh.getRange(r, 7).setValue(Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd HH:mm:ss'));
  });
}

// === TTL 칼럼 보정 (빈칸만 "-") ===
function updateRefreshTokenTTL() {
  const sh   = SpreadsheetApp.getActive().getSheetByName('토큰갱신');
  const last = sh.getLastRow();
  if (last < 2) return;

  for (let r = 2; r <= last; r++) {
    if (!sh.getRange(r, 4).getValue()) sh.getRange(r, 4).setValue('-');
  }
}

// === GET 요청 대응 (단순 안내) ===
function doGet() {
  return ContentService.createTextOutput('토큰 발급은 POST 요청으로만 처리됩니다.');
}

// --------- 아래 함수들은 기존 구현 유지 (본문 생략) ---------
// logRegularTriggerMapped()
// getKakaoFriendsToSheet()
// notifyTokenRefreshFailures()
