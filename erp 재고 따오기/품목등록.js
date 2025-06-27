function importProductListFromEcount() {
  const sessionId = loginToEcountWithOfficialKey(); // 세션 자동 발급
  const url = `https://oapiCB.ecount.com/OAPI/V2/InventoryBasic/GetBasicProductsList?SESSION_ID=${sessionId}`;

  const payload = {
    START_NO: 1,
    MAX_CNT: 50, // 필요 시 100, 500까지 가능
    VIEW_ROW_COUNT: 50,
    SEARCH_CONDITION: {
      PROD_CD: '',
      USE_YN: 'Y',
    },
  };

  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  };

  const response = UrlFetchApp.fetch(url, options);
  const result = JSON.parse(response.getContentText());
  Logger.log(result);

  const sheet =
    SpreadsheetApp.getActiveSpreadsheet().getSheetByName('품목목록') ||
    SpreadsheetApp.getActiveSpreadsheet().insertSheet('품목목록');
  sheet.clear();

  if (result.Data && result.Data.Result && result.Data.Result.length > 0) {
    const rows = result.Data.Result;
    const headers = Object.keys(rows[0]);
    sheet.appendRow(headers);

    rows.forEach(row => {
      sheet.appendRow(headers.map(key => row[key]));
    });
  } else {
    sheet.appendRow(['데이터 없음 또는 오류 발생']);
    sheet.appendRow([JSON.stringify(result)]);
  }
}
function importProductListFromEcount() {
  const sessionId = loginToEcountWithOfficialKey(); // 세션 자동 발급
  const url = `https://oapiCB.ecount.com/OAPI/V2/InventoryBasic/GetBasicProductsList?SESSION_ID=${sessionId}`;

  const payload = {
    START_NO: 1,
    MAX_CNT: 50, // 필요 시 100, 500까지 가능
    VIEW_ROW_COUNT: 50,
    SEARCH_CONDITION: {
      PROD_CD: '',
      USE_YN: 'Y',
    },
  };

  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  };

  const response = UrlFetchApp.fetch(url, options);
  const result = JSON.parse(response.getContentText());
  Logger.log(result);

  const sheet =
    SpreadsheetApp.getActiveSpreadsheet().getSheetByName('품목목록') ||
    SpreadsheetApp.getActiveSpreadsheet().insertSheet('품목목록');
  sheet.clear();

  if (result.Data && result.Data.Result && result.Data.Result.length > 0) {
    const rows = result.Data.Result;
    const headers = Object.keys(rows[0]);
    sheet.appendRow(headers);

    rows.forEach(row => {
      sheet.appendRow(headers.map(key => row[key]));
    });
  } else {
    sheet.appendRow(['데이터 없음 또는 오류 발생']);
    sheet.appendRow([JSON.stringify(result)]);
  }
}
