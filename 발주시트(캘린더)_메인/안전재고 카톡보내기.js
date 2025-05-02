/**
 * 트리거 대시보드용 백데이터 (문서 ID 기준 기록)
 *
 * @param {string} docId - '정기 트리거 상태' 시트 B열의 문서 ID
 */
function logRegularTriggerMapped(docId) {
  var dashboard = SpreadsheetApp.openById("1YMH0u-NRghspwapeczB-siQPs022f3H2EFVp7tPX31s");
  var sheet     = dashboard.getSheetByName("정기 트리거 상태");
  var data      = sheet.getDataRange().getValues();
  var now       = new Date();

  // B열 문서 ID가 docId와 일치하고, E열(status)가 비어있는 첫 행에만 기록
  for (var i = 1; i < data.length; i++) {
    var rowDocId = data[i][1];  // B열: 문서 ID
    var status   = data[i][4];  // E열: 상태
    if (rowDocId === docId && !status) {
      sheet.getRange(i + 1, 5).setValue("✅ 실행됨"); // E열: 작동유무
      sheet.getRange(i + 1, 6).setValue(now);         // F열: 실행 시간
      return;
    }
  }
}

// --------------------------------------------------
// 3. 메시지 전송
// --------------------------------------------------
function sendKakaoMessagesFromSheet() {
  logRegularTriggerMapped("sendKakaoMessagesFromSheet");
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const shMsg = ss.getSheetByName("카톡 내용보낼거");
  const token = ss.getSheetByName("UUID").getRange("F1").getValue();

  const lastRow = shMsg.getLastRow();
  for (let r = 4; r <= lastRow; r++) {
    // A열 값이 없으면 더 이상 처리하지 않고 루프 종료
    if (!shMsg.getRange(r, 1).getValue()) break;

    const uuid = shMsg.getRange(r, 9).getValue();
    const msg  = shMsg.getRange(r, 11).getValue();
    if (!uuid || !msg) continue;

    const payload = {
      receiver_uuids: JSON.stringify([uuid]),
      template_object: JSON.stringify({
        object_type: "text",
        text: msg,
        link: {
          web_url:       "https://kakao-test-ebon.vercel.app/go.html?doc=구매페이지",
          mobile_web_url:"https://kakao-test-ebon.vercel.app/go.html?doc=구매페이지"
        }
      })
    };

    const res = UrlFetchApp.fetch(
      "https://kapi.kakao.com/v1/api/talk/friends/message/default/send",
      {
        method:      "post",
        headers:     {
          Authorization: "Bearer " + token,
          "Content-Type":"application/x-www-form-urlencoded"
        },
        payload:     payload,
        muteHttpExceptions: true
      }
    );

    const ok = JSON.parse(res.getContentText()).successful_receiver_uuids;
    shMsg.getRange(r, 12)
         .setValue(ok && ok.length ? "✅ 성공" : "❌ 실패");
  }
}




/**
 * 권한 재승인 테스트용
 */
function authorize() {
  // Drive 접근과 UrlFetch 권한 두 가지를 모두 요청하기 위해
  DriveApp.getRootFolder();
  UrlFetchApp.fetch('https://www.google.com');
}