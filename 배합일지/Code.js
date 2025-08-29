function moveTimestamps() {
  try {
    const sheet1 = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('시트1');
    const viewSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('뷰');

    if (!sheet1 || !viewSheet) {
      Browser.msgBox('시트1 또는 뷰 시트를 찾을 수 없습니다.');
      return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    console.log('오늘 날짜:', today);

    const lastRow = sheet1.getLastRow();
    console.log('마지막 행:', lastRow);

    if (lastRow === 0) {
      Browser.msgBox('시트1에 데이터가 없습니다.');
      return;
    }

    const timestampData = sheet1.getRange('A1:A' + lastRow).getValues();
    const todayTimestamps = [];

    for (let i = 0; i < timestampData.length; i++) {
      const cellValue = timestampData[i][0];
      console.log(`행 ${i + 1}:`, cellValue);

      if (cellValue && (cellValue instanceof Date || typeof cellValue === 'string')) {
        let cellDate;

        if (cellValue instanceof Date) {
          cellDate = new Date(cellValue);
        } else if (typeof cellValue === 'string') {
          // 문자열에서 날짜 부분만 추출 (예: "2025.08.28 오후 03:06:15" -> "2025.08.28")
          const dateStr = cellValue.toString().split(' ')[0];
          console.log('추출된 날짜 문자열:', dateStr);

          // 점(.)을 슬래시(/)로 변경하여 Date 객체 생성
          const formattedDateStr = dateStr.replace(/\./g, '/');
          cellDate = new Date(formattedDateStr);

          if (isNaN(cellDate.getTime())) {
            console.log('유효하지 않은 날짜:', cellValue);
            continue;
          }
        }

        cellDate.setHours(0, 0, 0, 0);

        const todayStr = today.getFullYear() + '/' + (today.getMonth() + 1) + '/' + today.getDate();
        const cellDateStr =
          cellDate.getFullYear() + '/' + (cellDate.getMonth() + 1) + '/' + cellDate.getDate();

        console.log(`날짜 비교: ${cellDateStr} === ${todayStr}`);

        if (cellDate.getTime() === today.getTime()) {
          todayTimestamps.push([timestampData[i][0]]);
          console.log('매칭된 데이터 추가:', timestampData[i][0]);
        }
      }
    }

    console.log('오늘 날짜 데이터 개수:', todayTimestamps.length);

    viewSheet.getRange('B1:B11').clearContent();

    const maxRows = Math.min(todayTimestamps.length, 11);
    if (maxRows > 0) {
      viewSheet.getRange(`B1:B${maxRows}`).setValues(todayTimestamps.slice(0, maxRows));
      Browser.msgBox(`${maxRows}개의 오늘 날짜 데이터를 뷰 시트로 이동했습니다.`);

      // ERP 변환 함수 자동 실행
      SpreadsheetApp.getActiveSpreadsheet().toast(
        '타임스탬프 이동 완료. ERP 변환을 시작합니다...',
        '진행 중',
        3
      );
      Utilities.sleep(1000); // 1초 대기

      try {
        transformViewToERP(); // DataTransformer.js의 함수 호출
      } catch (erpError) {
        console.error('ERP 변환 중 오류:', erpError);
        Browser.msgBox('ERP 변환 중 오류가 발생했습니다: ' + erpError.message);
      }
    } else {
      Browser.msgBox('오늘 날짜에 해당하는 데이터가 없습니다.');
    }
  } catch (error) {
    console.error('오류:', error);
    Browser.msgBox('오류가 발생했습니다: ' + error.message);
  }
}

function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('생산뷰').addItem('타임스템프 이동', 'moveTimestamps').addToUi();
}
