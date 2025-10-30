// 시트에 직접 출력하는 디버깅 함수
function testLoginWithSheetDebug() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const debugSheet = ss.getSheetByName('디버그') || ss.insertSheet('디버그');
  debugSheet.clear();

  let row = 1;
  function log(msg) {
    debugSheet.getRange(row++, 1).setValue(msg);
  }

  log('=== 디버깅 시작 ===');

  const apiUrl = 'https://oapiCB.ecount.com/OAPI/V2/OAPILogin';
  log('API URL: ' + apiUrl);

  const payload = {
    COM_CODE: '606274',
    USER_ID: 'OOSDREAM',
    API_CERT_KEY: '1b633bde6273d4ce2ae69e3b357e41eda0',
    LAN_TYPE: 'ko-KR',
    ZONE: 'CB',
  };
  log('페이로드: ' + JSON.stringify(payload));

  try {
    log('UrlFetchApp.fetch 호출 중...');

    const res = UrlFetchApp.fetch(apiUrl, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
    });

    log('응답 받음!');

    const statusCode = res.getResponseCode();
    log('HTTP 상태 코드: ' + statusCode);

    const responseText = res.getContentText();
    log('응답 본문 길이: ' + responseText.length + ' 바이트');
    log('응답 본문: ' + responseText.substring(0, 500)); // 처음 500자만

    if (statusCode === 200) {
      const j = JSON.parse(responseText);
      log('JSON 파싱 성공');
      log('Status: ' + j.Status);
      log('Message: ' + (j.Message || '없음'));

      if (j.Data && j.Data.Datas && j.Data.Datas.SESSION_ID) {
        log('✅ 세션 ID: ' + j.Data.Datas.SESSION_ID);
      } else {
        log('❌ 세션 ID 없음');
        log('Data 구조: ' + JSON.stringify(j.Data));
      }
    } else {
      log('❌ HTTP 에러');
    }

  } catch (e) {
    log('🔥 예외 발생!');
    log('예외 타입: ' + e.toString());
    log('예외 메시지: ' + e.message);
    log('예외 스택: ' + e.stack);
  }

  log('=== 디버깅 종료 ===');
  log('');
  log('이제 "디버그" 시트를 확인하세요!');
}
