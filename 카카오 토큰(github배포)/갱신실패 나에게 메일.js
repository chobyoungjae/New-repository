/**
 * 토큰갱신 시트 전체를 스캔해서
 * F열에 '갱신실패'가 포함된 행을 찾아
 * 카카오메모 + 이메일 발송 후 H열에 'SENT' 표시
 */
function notifyTokenRefreshFailures() {
  const ss         = SpreadsheetApp.getActive();
  const sheet      = ss.getSheetByName('토큰갱신');
  const tokenSheet = ss.getSheetByName('카카오친구목록');
  if (!sheet || !tokenSheet) return;

  const accessToken = tokenSheet.getRange('F1').getValue();
  const kakaoUrl    = 'https://kapi.kakao.com/v2/api/talk/memo/default/send';
  const emailTo     = 'oosdream3@gmail.com';
  const deepLink    = 'https://kakao-test-ebon.vercel.app/go.html?doc=카카오토큰발급';

  // 시트 전체 데이터 읽기
  const data = sheet.getDataRange().getValues();
  // 0: 헤더, 실제 데이터는 1번 행부터
  for (let i = 1; i < data.length; i++) {
    const row      = data[i];
    const name     = row[0];    // A열
    const fullText = row[5];    // F열
    const status   = row[7];    // H열

    // 조건: F열 값이 문자열이고, 빈칸 아니며, '갱신완료'가 아닐 때만 처리
    if (typeof fullText === 'string'
        && fullText
        && fullText !== '갱신완료'
        && status !== 'SENT') {

      // ——— 1) 카카오메모 발송 ———
      const template = {
        object_type: 'text',
        text: `${name} / ${fullText}`,
        link: {
          web_url: deepLink,
          mobile_web_url: deepLink
        }
      };
      UrlFetchApp.fetch(kakaoUrl, {
        method: 'post',
        headers: { Authorization: 'Bearer ' + accessToken },
        payload: { template_object: JSON.stringify(template) },
        muteHttpExceptions: true
      });

      // ——— 2) 이메일 발송 ———
      const subject = '토큰 갱신 실패 알림: ' + name;
      const body    = `이름: ${name}\n결과: ${fullText}\n\n▶ 상세보기: ${deepLink}`;
      MailApp.sendEmail(emailTo, subject, body);

      // ——— 3) H열에 SENT 표시 ———
      sheet.getRange(i+1, 8).setValue('SENT');
    }
  }
}
