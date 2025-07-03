function doGet(e) {
  // 문서 리스트 반환 (기존)
  if (e.parameter.action === "list") {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("시트1"); // 시트 이름 맞게 수정
    var data = sheet.getDataRange().getValues();
    var richData = sheet.getDataRange().getRichTextValues(); // 하이퍼링크 추출용
    var docs = [];
    for (var i = 1; i < data.length; i++) { // 0번째는 헤더
      docs.push({
        timestamp: data[i][0],      // A열
        docName: data[i][1],        // B열
        author: data[i][2],         // C열
        content1: data[i][3],       // D열
        content2: data[i][4],       // E열
        content3: data[i][5],       // F열
        content4: data[i][6],       // G열
        teamLeaderSign: data[i][7], // H열
        reviewerSign: data[i][8],   // I열
        ceoSign: data[i][9],        // J열
        signUrl: (richData[i][12] && richData[i][12].getLinkUrl) ? richData[i][12].getLinkUrl() : "", // M열 하이퍼링크 URL 추출
        pdfUrl: data[i][14],        // O열 (15번째, 0부터 시작)
      });
    }
    // 최신순 정렬 (타임스탬프 기준, 내림차순)
    docs.sort(function(a, b) {
      return new Date(b.timestamp) - new Date(a.timestamp);
    });
    return ContentService.createTextOutput(JSON.stringify(docs)).setMimeType(ContentService.MimeType.JSON);
  }

  // [추가] 작성자 이름과 같은 시트의 첫 번째 데이터(문서) 반환
  if (e.parameter.action === "getDoc" && e.parameter.author) {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(e.parameter.author);
    if (!sheet) {
      return ContentService.createTextOutput(JSON.stringify({ error: "시트 없음" })).setMimeType(ContentService.MimeType.JSON);
    }
    var data = sheet.getDataRange().getValues();
    if (data.length < 2) {
      return ContentService.createTextOutput(JSON.stringify({ error: "데이터 없음" })).setMimeType(ContentService.MimeType.JSON);
    }
    var headers = data[0];
    var values = data[1];
    var doc = {};
    headers.forEach(function(h, i) {
      doc[h] = values[i];
    });
    return ContentService.createTextOutput(JSON.stringify(doc)).setMimeType(ContentService.MimeType.JSON);
  }

  // action 파라미터 없거나 잘못된 경우
  return ContentService.createTextOutput(JSON.stringify({ error: "Invalid action" })).setMimeType(ContentService.MimeType.JSON);
}