function completeSignupForProblemUsers() {
  const SHEET = SpreadsheetApp.getActive().getSheetByName('토큰갱신');

  // 문제 되던 두 사람 이름을 정확히 써 주세요
  const TARGETS = ['이지혜', '이재훈'];

  TARGETS.forEach(name => {
    const rows = SHEET.getRange(2, 1, SHEET.getLastRow() - 1, 1)
      .getValues()
      .flat();
    const idx = rows.indexOf(name);
    if (idx < 0) {
      Logger.log('행을 찾지 못했습니다: ' + name);
      return;
    }
    const access = SHEET.getRange(idx + 2, 2).getValue(); // B열 Access Token
    UrlFetchApp.fetch('https://kapi.kakao.com/v2/user/me', {
      headers: { Authorization: 'Bearer ' + access },
    });
    Logger.log(name + ' → 가입 완료 호출 OK');
  });
}
