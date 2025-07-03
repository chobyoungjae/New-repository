/**
 * 트리거 대시보드용 백데이터 (문서 ID 기준 기록)
 *
 * @param {string} docId - '정기 트리거 상태' 시트 B열의 문서 ID
 */
function logRegularTriggerMapped(docId) {
  var dashboard = SpreadsheetApp.openById('1YMH0u-NRghspwapeczB-siQPs022f3H2EFVp7tPX31s');
  var sheet = dashboard.getSheetByName('정기 트리거 상태');
  var data = sheet.getDataRange().getValues();
  var now = new Date();

  // B열 문서 ID가 docId와 일치하고, E열(status)가 비어있는 첫 행에만 기록
  for (var i = 1; i < data.length; i++) {
    var rowDocId = data[i][1]; // B열: 문서 ID
    var status = data[i][4]; // E열: 상태
    if (rowDocId === docId && !status) {
      sheet.getRange(i + 1, 5).setValue('✅ 실행됨'); // E열: 작동유무
      sheet.getRange(i + 1, 6).setValue(now); // F열: 실행 시간
      return;
    }
  }
}

/**
 * ✅ 1. 카카오 액세스 토큰 저장
 */
function setKakaoAccessToken() {
  const token = 'GO501d-3HAViM0pW6jrMhAZEgZM11Yz8AAAAAQoNDF4AAAGWWAjFr4a1Lb_-w10F';
  PropertiesService.getScriptProperties().setProperty('KAKAO_ACCESS_TOKEN', token);
}

/**
 * ✅ 2. 친구 목록 불러오기
 * - 시트: '카카오친구목록'
 * - 열: A 이름 / B UUID / C 메시지 허용
 */
function getKakaoFriendsToSheet() {
  logRegularTriggerMapped('getKakaoFriendsToSheet');
  refreshKakaoAccessToken();

  const accessToken = PropertiesService.getScriptProperties().getProperty('KAKAO_ACCESS_TOKEN');
  const refreshToken = PropertiesService.getScriptProperties().getProperty('KAKAO_REFRESH_TOKEN');

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('카카오친구목록');
  sheet.clear();

  // ✅ 맨 위에 토큰 먼저 표시 (F1, G1)
  sheet.getRange('F1').setValue(accessToken);
  sheet.getRange('G1').setValue(refreshToken);
  sheet.getRange('F2').setValue('access_token');
  sheet.getRange('G2').setValue('refresh_token');

  // ✅ 친구 목록 헤더 (A3~)
  sheet.getRange('A3:C3').setValues([['닉네임', 'UUID', '메시지 허용']]);

  try {
    const response = UrlFetchApp.fetch('https://kapi.kakao.com/v1/api/talk/friends', {
      method: 'get',
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const data = JSON.parse(response.getContentText());

    const now = new Date();
    sheet
      .getRange('A1')
      .setValue(
        '📥 친구 목록 갱신: ' +
          Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss')
      );

    if (data.elements?.length > 0) {
      const rows = data.elements.map(friend => [
        friend.profile_nickname || '',
        friend.uuid || '',
        friend.allowed_msg || '',
      ]);
      sheet.getRange(4, 1, rows.length, 3).setValues(rows); // A4~에 친구 목록
    } else {
      sheet.getRange('A4').setValue('⚠️ 친구 없음');
    }
  } catch (e) {
    sheet.getRange('A4').setValue('❌ 오류: ' + e.message);
    sheet
      .getRange('A1')
      .setValue(
        '❌ 오류 발생 시간: ' +
          Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss')
      );
    Logger.log('친구 목록 오류: ' + e.message);
  }
}

/**
 * ✅ 3. 카카오톡 메시지 전송 (버튼 없이 링크만 포함)
 * - 시트명: 카톡 내용보낼거
 * - H열: 담당자 이름 (사용 X)
 * - I열: UUID
 * - K열: 메시지 내용
 * - L열: 전송 결과
 */
function sendKakaoMessagesFromSheet() {
  logRegularTriggerMapped('sendKakaoMessagesFromSheet');

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('카톡 내용보낼거');
  const token = PropertiesService.getScriptProperties().getProperty('KAKAO_ACCESS_TOKEN');

  const lastRow = sheet.getLastRow();

  for (let row = 2; row <= lastRow; row++) {
    const uuid = sheet.getRange(row, 9).getValue(); // I열 = 9
    const message = sheet.getRange(row, 11).getValue(); // K열 = 11
    const resultCell = sheet.getRange(row, 12); // L열 = 12

    if (!uuid || !message) {
      // 메시지가 없거나 UUID가 없으면 건너뛰기
      continue;
    }

    const payload = {
      receiver_uuids: JSON.stringify([uuid]),
      template_object: JSON.stringify({
        object_type: 'text',
        text: message,
        link: {
          web_url: 'https://kakao-test-ebon.vercel.app/go.html?doc=구매페이지',
          mobile_web_url: 'https://kakao-test-ebon.vercel.app/go.html?doc=구매페이지',
        },
      }),
    };

    const options = {
      method: 'post',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      payload: payload,
    };

    try {
      const response = UrlFetchApp.fetch(
        'https://kapi.kakao.com/v1/api/talk/friends/message/default/send',
        options
      );
      const result = JSON.parse(response.getContentText());

      if (result.successful_receiver_uuids?.length > 0) {
        resultCell.setValue('✅ 성공');
      } else {
        resultCell.setValue('❌ 실패');
      }
    } catch (e) {
      resultCell.setValue('❌ 오류: ' + e.message);
      Logger.log('전송 실패:', e);
    }
  }
}
