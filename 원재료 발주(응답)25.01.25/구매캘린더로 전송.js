function moveToBuyCalendar(e) {
  var sheet = e.range.getSheet();
  var sheetName = sheet.getName();
  var row = e.range.getRow();
  var col = e.range.getColumn();
  var value = e.value;

  var 원시트 = ['부재료(박스)', '부재료(포장지)', '원재료'];
  if (원시트.indexOf(sheetName) === -1 || col !== 14 || value !== '발주완료') return;

  var ss = sheet.getParent();
  var 구매캘린더 = ss.getSheetByName('구매 캘린더');
  if (!구매캘린더) {
    SpreadsheetApp.getUi().alert('구매 캘린더 시트가 없습니다!');
    return;
  }

  var rowData = sheet.getRange(row, 1, 1, 15).getValues()[0];
  var I열값 = sheetName === '원재료' ? '핑크' : '노랑';

  var now = new Date();
  var timeString = Utilities.formatDate(now, 'Asia/Seoul', 'yyyy. M. d a h:mm:ss')
    .replace('AM', '오전')
    .replace('PM', '오후');

  var newRow = [
    timeString, // A열: 타임스탬프
    rowData[4], // B열: E열
    '', // C열: (비움)
    rowData[7], // D열: H열 (코드번호)
    rowData[8], // E열: I열 (원시트의 I열 값)
    rowData[5], // F열: F열
    rowData[3], // G열: D열
    '', // H열: (비움)
    I열값, // I열: 노랑/핑크 (시트별)
  ];

  // 실제 데이터가 있는 마지막 행 찾기 (A열 기준)
  var lastDataRow = 구매캘린더.getRange('A:A').getValues().filter(String).length;
  var targetRow = lastDataRow + 1;
  구매캘린더.getRange(targetRow, 1, 1, newRow.length).setValues([newRow]);

  // --- L열(12번째)에 체크박스 조건 처리 ---
  var 코드번호 = newRow[3]; // D열(코드번호)
  var 거래처시트 = null;
  try {
    거래처시트 = ss.getSheetByName('해당거래처');
  } catch (err) {
    거래처시트 = null;
  }
  var needCheckbox = false;
  if (거래처시트) {
    var 거래처Data = 거래처시트.getDataRange().getValues();
    for (var i = 1; i < 거래처Data.length; i++) {
      // 1번 인덱스부터(헤더 제외)
      // B열(1) == 코드번호 && K열(10) == '선입금'
      if (
        String(거래처Data[i][1]).trim() == String(코드번호).trim() &&
        String(거래처Data[i][10]).trim() == '선입금'
      ) {
        needCheckbox = true;
        break;
      }
    }
  }
  if (needCheckbox) {
    var lCell = 구매캘린더.getRange(targetRow, 12); // L열(12번째)
    lCell.insertCheckboxes();
    lCell.setValue(false);
  }
}
