
/**
 * 친구 목록 갱신
 * 시트: 친구목록불러오기
 * 토큰 시트: 토큰갱신 (A: 이름, B: Access Token, C: Refresh Token)
 * 결과 시트 F열: Timestamp
 */
function getKakaoFriendsToSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const friendSheet = ss.getSheetByName('친구목록불러오기');
  if (!friendSheet) throw new Error('시트를 찾을 수 없습니다: 친구목록불러오기');

  const tokenSheet = ss.getSheetByName('토큰갱신');
  if (!tokenSheet) throw new Error('시트를 찾을 수 없습니다: 토큰갱신');

  // 사용자 이름으로 토큰 찾기
  const nameToFind = '조병재';
  const tokenData = tokenSheet.getRange(2, 1, tokenSheet.getLastRow() - 1, 3).getValues();
  const idx = tokenData.findIndex(row => row[0] === nameToFind);
  if (idx < 0) throw new Error(`토큰 시트에서 ${nameToFind} 행을 찾을 수 없습니다.`);
  const rowNum = idx + 2;
  const token = tokenSheet.getRange(rowNum, 2).getValue();

  // 친구 목록 API 호출
  const url = 'https://kapi.kakao.com/v1/api/talk/friends';
  const options = {
    method: 'get',
    headers: { Authorization: 'Bearer ' + token },
    muteHttpExceptions: true
  };
  const resp = UrlFetchApp.fetch(url, options);
  if (resp.getResponseCode() === 401) {
    throw new Error('토큰이 만료되었거나 유효하지 않습니다. 토큰갱신 시트를 확인하세요.');
  }
  if (resp.getResponseCode() !== 200) {
    throw new Error(`친구 목록 호출 실패(${resp.getResponseCode()}): ${resp.getContentText()}`);
  }
  const elements = JSON.parse(resp.getContentText()).elements || [];

  // 결과 시트 초기화
  if (friendSheet.getLastRow() >= 4) {
    friendSheet.getRange(4, 1, friendSheet.getLastRow() - 3, 6).clearContent();
  }
  const now = new Date();
  const ts = Utilities.formatDate(now, ss.getSpreadsheetTimeZone(), 'yyyy-MM-dd HH:mm:ss');
  friendSheet.getRange('A1').setValue('친구 목록 갱신: ' + ts);
  friendSheet.getRange('A3:F3').setValues([['이름', 'UUID', '메시지 허용', '', '', 'Timestamp']]);

  // 데이터 입력
  if (elements.length) {
    const values = elements.map(f => [
      f.profile_nickname,
      f.uuid,
      f.allowed_msg,
      '',
      '',
      ts
    ]);
    friendSheet.getRange(4, 1, values.length, 6).setValues(values);
  } else {
    friendSheet.getRange('A4:F4').setValues([['⚠️ 친구 없음', '', '', '', '', ts]]);
  }
}
