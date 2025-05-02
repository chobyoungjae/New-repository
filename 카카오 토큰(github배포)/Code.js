/**
 * static 페이지에서 form POST로 넘어온
 * state(이름), access_token, refresh_token 을 받아서
 * '토큰갱신' 시트에 기록합니다.
 * A열: 이름, B열: Access Token, C열: Refresh Token,
 * D열: 최초토큰발급, E열: 발급 Timestamp
 */
const REST_API_KEY = 'b753d319ccd4300a4c957d7d4c6c9b96'; // 카카오 REST API Key

function doPost(e) {
  // URL-encoded form 또는 JSON 바디 모두 처리
  const p = (e.parameter && Object.keys(e.parameter).length)
    ? e.parameter
    : JSON.parse(e.postData.contents || '{}');

  const name = p.state;
  const accessToken = p.access_token;
  const refreshToken = p.refresh_token;

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName('토큰갱신');
  if (!sh) throw new Error("'토큰갱신' 시트를 찾을 수 없습니다.");

  // 헤더 초기화 (A1:C1)
  const hdr = sh.getRange('A1:C1').getValues()[0];
  if (hdr[0] !== 'Name' || hdr[1] !== 'Access Token' || hdr[2] !== 'Refresh Token') {
    sh.clear();
    sh.getRange('A1:C1').setValues([['Name','Access Token','Refresh Token']]);
  }

  // 데이터 입력 또는 업데이트
  const lastRow = sh.getLastRow();
  const names = lastRow > 1
    ? sh.getRange(2, 1, lastRow - 1, 1).getValues().flat()
    : [];
  let row;
  const idx = names.indexOf(name);
  if (idx >= 0) {
    row = idx + 2;
    sh.getRange(row, 2).setValue(accessToken);
    sh.getRange(row, 3).setValue(refreshToken);
  } else {
    row = sh.appendRow([name, accessToken, refreshToken]).getRow();
  }

  // 최초 발급 상태 및 발급 시각 기록
  const now = new Date();
  const ts = Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
  sh.getRange(row, 4).setValue('최초토큰발급');
  sh.getRange(row, 5).setValue(ts);

  return ContentService.createTextOutput('ok');
}

/**
 * '토큰갱신' 시트에 있는 모든 리프레시 토큰으로
 * 액세스 토큰과 리프레시 토큰을 갱신하고,
 * F열: 갱신 상태, G열: 갱신 Timestamp를 기록합니다.
 */
function refreshAllTokens() {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('토큰갱신');
  if (!sh) throw new Error("'토큰갱신' 시트를 찾을 수 없습니다.");

  const data = sh.getRange(2, 1, sh.getLastRow() - 1, 3).getValues();
  data.forEach((row, i) => {
    const refresh = row[2];
    const rowIndex = i + 2;
    if (!refresh) {
      sh.getRange(rowIndex, 6).setValue('갱신불가: 토큰없음');
      return;
    }
    try {
      const resp = UrlFetchApp.fetch('https://kauth.kakao.com/oauth/token', {
        method: 'post',
        payload: {
          grant_type: 'refresh_token',
          client_id: REST_API_KEY,
          refresh_token: refresh
        }
      });
      const json = JSON.parse(resp.getContentText());
      // 갱신 성공, 토큰 업데이트
      if (json.access_token) {
        sh.getRange(rowIndex, 2).setValue(json.access_token);
      }
      if (json.refresh_token) {
        sh.getRange(rowIndex, 3).setValue(json.refresh_token);
      }
      const now = new Date();
      const ts = Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
      sh.getRange(rowIndex, 6).setValue('갱신완료');
      sh.getRange(rowIndex, 7).setValue(ts);
    } catch (err) {
      // 실패 시 직관적 메시지
      let msg = '갱신실패';
      if (err.message && err.message.includes('invalid_grant')) {
        msg = '갱신실패: refresh_token이 만료되었거나 유효하지 않습니다. 재인증이 필요합니다.';
      } else {
        msg = '갱신실패: ' + err.message;
      }
      sh.getRange(rowIndex, 6).setValue(msg);
    }
  });
}

/**
 * 브라우저 GET 요청에 응답하기 위한 doGet 핸들러
 */
function doGet(e) {
  return ContentService.createTextOutput(
    "토큰 발급은 POST 요청으로만 처리됩니다."
  );
}
