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

// 1) 로그인 → 세션 ID 반환
function loginToEcountWithOfficialKey() {
  const apiUrl = "https://oapicb.ecount.com/OAPI/V2/OAPILogin";
  const payload = {
    COM_CODE:     "606274",
    USER_ID:      "OOSDREAM",
    API_CERT_KEY: "1b633bde6273d4ce2ae69e3b357e41eda0",
    LAN_TYPE:     "ko-KR",
    ZONE:         "CB"
  };
  const options = {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };
  const res = UrlFetchApp.fetch(apiUrl, options);
  try {
    const j = JSON.parse(res.getContentText());
    return (j.Status === "200" && j.Data && j.Data.Datas && j.Data.Datas.SESSION_ID)
      ? j.Data.Datas.SESSION_ID
      : null;
  } catch (e) {
    Logger.log("로그인 JSON 파싱 오류:", e);
    return null;
  }
}

// 2) 단건 품목코드 → 제품명 조회
function getProductName(sessionId, prodCd) {
  const apiUrl = `https://oapicb.ecount.com/OAPI/V2/InventoryBasic/ViewBasicProduct?SESSION_ID=${sessionId}`;
  const options = {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify({ PROD_CD: prodCd }),
    muteHttpExceptions: true
  };
  const res = UrlFetchApp.fetch(apiUrl, options);
  try {
    const j = JSON.parse(res.getContentText());
    return (j.Status === "200" && j.Data && j.Data.Result && j.Data.Result[0])
      ? j.Data.Result[0].PROD_DES
      : "";
  } catch (e) {
    Logger.log(`품목명 조회 오류 [${prodCd}]:`, e);
    return "";
  }
}

// 3) 전체 재고 조회 + 제품명 붙이기 (공장 + 창고 모두 포함)
function importInventoryListFromEcount() {
  const sessionId = loginToEcountWithOfficialKey();
  if (!sessionId) {
    Logger.log("세션 획득 실패");
    return;
  }

  // 조회할 위치 코드(공장 및 창고) 배열
  const locationCodes = [
    "00001", // 미쓰리(공장)
    "00006", // 배합실(공장)
    "00004", // 불출창고(공장)
    "00003", // 완제품창고
    "00002"  // 원재료창고
  ];

  const baseDate = Utilities.formatDate(new Date(), "Asia/Seoul", "yyyyMMdd");
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("재고현황") || ss.insertSheet("재고현황");
  sheet.clear();

  // A1에 업데이트 시간 기록
  const now = Utilities.formatDate(new Date(), "Asia/Seoul", "yyyy-MM-dd HH:mm:ss");
  sheet.getRange("A1").setValue(`업데이트 시간: ${now}`);
  sheet.appendRow(["위치코드", "품목코드", "제품명", "재고수량"]);

  locationCodes.forEach(code => {
    const apiUrl = `https://oapicb.ecount.com/OAPI/V2/InventoryBalance/GetListInventoryBalanceStatus?SESSION_ID=${sessionId}`;
    const options = {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify({ PROD_CD: "", WH_CD: code, BASE_DATE: baseDate }),
      muteHttpExceptions: true
    };
    try {
      const res = UrlFetchApp.fetch(apiUrl, options);
      const data = JSON.parse(res.getContentText());
      if (data.Status === "200" && data.Data && data.Data.Result) {
        data.Data.Result.forEach(item => {
          const name = getProductName(sessionId, item.PROD_CD);
          sheet.appendRow([code, item.PROD_CD, name, item.BAL_QTY]);
        });
        Logger.log(`✅ 위치 ${code} 조회 완료`);
      } else {
        Logger.log(`⚠️ 위치 ${code} 조회 실패:`, JSON.stringify(data));
      }
    } catch (e) {
      Logger.log(`❌ 위치 ${code} 에러:`, e.message);
    }
  });
}

// 4) 실행 진입점
function runImportInventory() {
  logRegularTriggerMapped("runImportInventory");
  importInventoryListFromEcount();
}

