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
 * onEdit 이벤트 핸들러: 발주확인/발주완료 드롭다운 선택 시 카카오 메시지 전송
 */
function onEdit(e) {
  var range = e.range;
  var sheet = range.getSheet();
  var row = range.getRow();
  var col = range.getColumn();
  var value = e.value;
  var sheetName = sheet.getName();
  SpreadsheetApp.getActiveSpreadsheet().toast('발주확인 트리거됨: 행 ' + row, 'onEdit Debug', 3);

  // 대상 시트
  var targetSheets = ['부재료(박스)', '부재료(포장지)', '원재료'];
  if (targetSheets.indexOf(sheetName) === -1) return;

  // 친구 목록 로드
  var friendSheet = SpreadsheetApp.openById(
    '1FAYigya47GJWfTm4yysQSY9WCTDV8b0Du_rYnAtYug0'
  ).getSheetByName('UUID');
  var friendMap = getFriendMap(friendSheet);

  // 행 데이터
  var rowData = sheet.getRange(row, 1, 1, 15).getValues()[0];
  var purchaser = rowData[1]; // B열
  var item = rowData[2]; // C열
  var docId = rowData[1]; // B열 값 문서 ID
  var now = new Date();

  // 발주확인 (L열=12)
  if (col === 12 && value === '발주확인') {
    var logVal = sheet.getRange(row, 13).getValue(); // M열
    if (!logVal) {
      var message = purchaser + '이(가) ' + item + '를 발주해 달래 업체에 발주해줘~';
      var confirmUrl = 'https://kakao-test-ebon.vercel.app/go.html?doc=발주확인페이지';
      var result = sendKakaoTo('오수진', message, friendMap, confirmUrl);
      sheet.getRange(row, 13).setValue(now);
      Logger.log('📩 발주확인 메시지 전송 결과: %s', result);
    }
  }

  // 발주완료 (N열=14)
  if (col === 14 && value === '발주완료') {
    var logVal2 = sheet.getRange(row, 15).getValue(); // O열
    if (!logVal2) {
      var message2 = item + '를 발주 했대~ 캘린더 확인해봐~';
      var completeUrl = 'https://kakao-test-ebon.vercel.app/go.html?doc=구매캘린더';
      var result2 = sendKakaoTo(purchaser, message2, friendMap, completeUrl);
      sheet.getRange(row, 15).setValue(now);
      Logger.log('📩 발주완료 메시지 전송 결과: %s', result2);
    }
  }
}

/**
 * 이름 → UUID 매핑
 */
function getFriendMap(friendSheet) {
  var data = friendSheet.getDataRange().getValues();
  var map = {};
  for (var i = 1; i < data.length; i++) {
    var name = data[i][0];
    var uuid = data[i][1];
    if (name && uuid) map[name] = uuid;
  }
  return map;
}

/**
 * 카카오 친구에게 메시지 전송
 * @param {string} name - 수신자 이름
 * @param {string} message - 보낼 메시지 본문
 * @param {Object} friendMap - 이름→UUID 매핑 객체
 * @param {string} [linkUrl] - 버튼 클릭 시 이동할 URL (옵션)
 */
function sendKakaoTo(name, message, friendMap, linkUrl) {
  if (!friendMap || typeof friendMap !== 'object') {
    Logger.log('❌ friendMap 오류: %s', JSON.stringify(friendMap));
    return '❌ friendMap 오류';
  }
  var uuid = friendMap[name];
  if (!uuid) {
    Logger.log(`❌ UUID 없음: ${name}`);
    return `❌ UUID 없음: ${name}`;
  }
  var token = SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName('UUID')
    .getRange('F1')
    .getValue();
  if (!token) {
    Logger.log('❌ accessToken 누락');
    return '❌ access_token 누락';
  }
  var urlToUse = linkUrl || 'https://kakao-test-ebon.vercel.app/go.html?doc=' + name;
  var payload = {
    receiver_uuids: JSON.stringify([uuid]),
    template_object: JSON.stringify({
      object_type: 'text',
      text: message,
      link: {
        web_url: urlToUse,
        mobile_web_url: urlToUse,
      },
      button_title: '확인하러 가기',
    }),
  };
  var options = {
    method: 'post',
    contentType: 'application/x-www-form-urlencoded',
    headers: { Authorization: 'Bearer ' + token },
    payload: payload,
    muteHttpExceptions: true,
  };
  try {
    var response = UrlFetchApp.fetch(
      'https://kapi.kakao.com/v1/api/talk/friends/message/default/send',
      options
    );
    if (response.getResponseCode() === 200) {
      return Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm:ss');
    }
    return `⚠️ 실패 (${response.getResponseCode()})`;
  } catch (e) {
    return `❌ 오류: ${e.message}`;
  }
}

function logSheetNames() {
  var ss = SpreadsheetApp.openById('15RDzwxbuo2X3B95axNaU41rj0ZECxfpu4nySK9sjy60');
  var names = ss.getSheets().map(s => s.getName());
  Logger.log('시트 목록: ' + names.join(', '));
}