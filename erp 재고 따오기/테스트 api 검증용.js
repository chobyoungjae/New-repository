function testPurchaseOrderList() {
  const sessionId = "3630363237347c4f4f53445245414d:CB-ASGoY5EHhxU!d";  // 형님 테스트 세션 ID
  const apiKey = "4d2ff5709a1a640a2a186cde0aea3d0807";  // 테스트 인증키
  
  const url = `https://sboapiCB.ecount.com/OAPI/V2/Purchases/GetPurchasesOrderList?SESSION_ID=${sessionId}`;

  const payload = {
    "ListParam": {
      "BASE_DATE_FROM": "20230401",  // 시작 날짜 (형식: yyyyMMdd)
      "BASE_DATE_TO": "20230430",  // 종료 날짜 (형식: yyyyMMdd)
      "PAGE_CURRENT": 1,  // 페이지 번호
      "PAGE_SIZE": 26  // 표시할 줄 수
    }
  };

  const options = {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  const response = UrlFetchApp.fetch(url, options);
  const result = JSON.parse(response.getContentText());
  Logger.log(result);

  // 결과 확인 후 시트에 출력
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("발주서 조회") || SpreadsheetApp.getActiveSpreadsheet().insertSheet("발주서 조회");
  sheet.clear();

  if (result.Data && result.Data.Result && result.Data.Result.length > 0) {
    const rows = result.Data.Result;
    const headers = Object.keys(rows[0]);
    sheet.appendRow(headers);

    rows.forEach(row => {
      sheet.appendRow(headers.map(key => row[key]));
    });
  } else {
    sheet.appendRow(["데이터 없음 또는 오류 발생"]);
    sheet.appendRow([JSON.stringify(result)]);
  }
}
