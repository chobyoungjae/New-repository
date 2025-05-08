/**
 * 0) 카카오 토큰 읽기 & 알림 함수
 */
function getKakaoToken() {
  return SpreadsheetApp.getActive()
    .getSheetByName('카카오친구목록')
    .getRange('F1')
    .getValue();
}

function sendErrorAlert(title, message) {
  // 카카오톡 메시지
  var token = getKakaoToken();
  var kakaoUrl = 'https://kapi.kakao.com/v2/api/talk/memo/default/send';
  var template = {
    object_type: 'text',
    text: '[' + title + ']\n' + message
  };
  UrlFetchApp.fetch(kakaoUrl, {
    method: 'post',
    headers: { Authorization: 'Bearer ' + token },
    payload: { template_object: JSON.stringify(template) },
    muteHttpExceptions: true
  });
  // 이메일 발송
  MailApp.sendEmail('oosdream3@gmail.com', title, message);
}

/**
 * 트리거 대시보드용 백데이터 (문서 ID 기준 기록)
 */
function logRegularTriggerMapped(docId) {
  var dashboard = SpreadsheetApp.openById("1YMH0u-NRghspwapeczB-siQPs022f3H2EFVp7tPX31s");
  var sheet     = dashboard.getSheetByName("정기 트리거 상태");
  var data      = sheet.getDataRange().getValues();
  var now       = new Date();
  for (var i = 1; i < data.length; i++) {
    if (data[i][1] === docId && !data[i][4]) {
      sheet.getRange(i + 1, 5).setValue("✅ 실행됨");
      sheet.getRange(i + 1, 6).setValue(now);
      return;
    }
  }
}

// 1) 로그인 → 세션 ID 반환
function loginToEcountWithOfficialKey() {
  const apiUrl = "https://oapicb.ecount.com/OAPI/V2/OAPILogin";
  const payload = { COM_CODE: "606274", USER_ID: "OOSDREAM", API_CERT_KEY: "1b633bde6273d4ce2ae69e3b357e41eda0", LAN_TYPE: "ko-KR", ZONE: "CB" };
  const res = UrlFetchApp.fetch(apiUrl, { method: "post", contentType: "application/json", payload: JSON.stringify(payload), muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) return null;
  try {
    const j = JSON.parse(res.getContentText());
    return (j.Status === "200" && j.Data && j.Data.Datas && j.Data.Datas.SESSION_ID)
      ? j.Data.Datas.SESSION_ID : null;
  } catch (e) {
    Logger.log("로그인 JSON 파싱 오류:", e);
    return null;
  }
}

// 2) 단건 품목코드 → 제품명 조회
function getProductName(sessionId, prodCd) {
  const apiUrl = `https://oapicb.ecount.com/OAPI/V2/InventoryBasic/ViewBasicProduct?SESSION_ID=${sessionId}`;
  const res = UrlFetchApp.fetch(apiUrl, { method: "post", contentType: "application/json", payload: JSON.stringify({ PROD_CD: prodCd }), muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) return "";
  try {
    const j = JSON.parse(res.getContentText());
    return (j.Status === "200" && j.Data && j.Data.Result && j.Data.Result[0])
      ? j.Data.Result[0].PROD_DES : "";
  } catch (e) {
    Logger.log(`품목명 조회 오류 [${prodCd}]:`, e);
    return "";
  }
}

// 3) 전체 재고 조회 + 제품명 붙이기 (에러 발생 시 카톡+메일 알림)
function importInventoryListFromEcount() {
  const sessionId = loginToEcountWithOfficialKey();
  if (!sessionId) {
    sendErrorAlert('재고 조회 에러', '세션 획득 실패');
    return;
  }
  const locationCodes = ["00001","00006","00004","00003","00002"];
  const baseDate = Utilities.formatDate(new Date(), "Asia/Seoul", "yyyyMMdd");
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("재고현황") || ss.insertSheet("재고현황");
  sheet.clear();
  const now = Utilities.formatDate(new Date(), "Asia/Seoul", "yyyy-MM-dd HH:mm:ss");
  sheet.getRange("A1").setValue(`업데이트 시간: ${now}`);
  sheet.appendRow(["위치코드","품목코드","제품명","재고수량"]);

  locationCodes.forEach(code => {
    try {
      const apiUrl = `https://oapicb.ecount.com/OAPI/V2/InventoryBalance/GetListInventoryBalanceStatus?SESSION_ID=${sessionId}`;
      const res = UrlFetchApp.fetch(apiUrl, { method: "post", contentType: "application/json", payload: JSON.stringify({ PROD_CD: "", WH_CD: code, BASE_DATE: baseDate }), muteHttpExceptions: true });
      if (res.getResponseCode() !== 200) throw new Error(`HTTP ${res.getResponseCode()} at ${code}`);
      const data = JSON.parse(res.getContentText());
      if (data.Status === "200" && data.Data && data.Data.Result) {
        data.Data.Result.forEach(item => {
          const name = getProductName(sessionId, item.PROD_CD);
          sheet.appendRow([code, item.PROD_CD, name, item.BAL_QTY]);
        });
        Logger.log(`✅ 위치 ${code} 조회 완료`);
      } else {
        throw new Error(`Invalid data at ${code}`);
      }
    } catch (e) {
      Logger.log(`❌ 위치 ${code} 에러: ${e.message}`);
      sendErrorAlert('재고 조회 에러', `위치 ${code}: ${e.message}`);
    }
  });
}

// 4) 실행 진입점
function runImportInventory() {
  logRegularTriggerMapped("runImportInventory");
  importInventoryListFromEcount();
}
