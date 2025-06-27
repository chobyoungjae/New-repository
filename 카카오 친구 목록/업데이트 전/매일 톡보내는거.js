function sendKakaoMessages() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('카카오친구목록');

  const accessToken = sheet.getRange('F1').getValue();
  const refreshToken = sheet.getRange('G1').getValue(); // 필요시 자동 갱신 추가 가능
  const uuids = sheet
    .getRange('B4:B' + sheet.getLastRow())
    .getValues()
    .flat()
    .filter(Boolean);

  const today = new Date();
  const day = today.getDay(); // 0: 일, 1: 월 ... 6: 토

  let message = '';
  if (day >= 1 && day <= 5) {
    message = '오늘도 수고하셨어요.';
  } else {
    message = '식사하세요~';
  }

  uuids.forEach(uuid => {
    sendMessageToKakaoFriend(accessToken, uuid, message);
  });
}

function sendMessageToKakaoFriend(token, uuid, message) {
  const url = 'https://kapi.kakao.com/v1/api/talk/friends/message/default/send'; // ← 요기 수정

  const payload = {
    receiver_uuids: JSON.stringify([uuid]),
    template_object: JSON.stringify({
      object_type: 'text',
      text: message,
      link: {
        web_url: 'https://example.com',
        mobile_web_url: 'https://example.com',
      },
      button_title: '확인',
    }),
  };

  const options = {
    method: 'post',
    payload: payload,
    headers: {
      Authorization: 'Bearer ' + token,
    },
    muteHttpExceptions: true,
  };

  try {
    const response = UrlFetchApp.fetch(url, options);
    Logger.log(response.getContentText());
  } catch (e) {
    Logger.log('❌ 메시지 전송 실패: ' + e.message);
  }
}
