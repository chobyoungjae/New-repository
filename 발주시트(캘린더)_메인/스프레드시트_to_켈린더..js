function onOpen() {
  const ui = SpreadsheetApp.getUi();

  ui.createMenu('생산')
    .addItem('스프레드시트 → 캘린더', 'onClickShape')
    .addItem('캘린더 → 스프레드시트', 'showConfirmationAndUpdate')
    .addToUi();
}

function onClickShape() {
  var ui = SpreadsheetApp.getUi();
  var response = ui.alert(
    '일정 업데이트',
    '캘린더 일정을 업데이트하시겠습니까?',
    ui.ButtonSet.YES_NO
  );

  // Yes 버튼을 클릭한 경우에만 실행
  if (response == ui.Button.YES) {
    updateProductionCalendar();
  }
}

function updateProductionCalendar() {
  var sheet = SpreadsheetApp.getActiveSheet();
  var calendarId = 'bjcho9542@gmail.com'; // 생산 캘린더 ID
  var calendar = CalendarApp.getCalendarById(calendarId);

  if (!calendar) {
    SpreadsheetApp.getUi().alert('캘린더를 찾을 수 없습니다. 캘린더 ID를 확인해주세요.');
    return;
  }

  var lastRow = sheet.getLastRow();

  for (var i = 2; i <= lastRow; i++) {
    var status = sheet.getRange('A' + i).getValue();

    if (status === 'N') {
      var startDate = sheet.getRange('B' + i).getValue();
      var endDate = sheet.getRange('C' + i).getValue();
      var text1 = sheet.getRange('D' + i).getValue();
      var text2 = sheet.getRange('F' + i).getValue();
      var text3 = sheet.getRange('G' + i).getValue();
      var amount = sheet.getRange('H' + i).getValue();
      var quantity = sheet.getRange('I' + i).getValue();
      var colorId = sheet.getRange('J' + i).getValue(); // 색상 ID 가져오기
      var text4 = sheet.getRange('E' + i).getValue();
      var description = sheet.getRange('K' + i).getValue(); // 설명 가져오기

      if (!(startDate instanceof Date)) {
        startDate = new Date(startDate);
      }
      if (!(endDate instanceof Date)) {
        endDate = new Date(endDate);
      }

      // 제목에서 날짜를 제외하고 텍스트만 포함
      var title =
        text1 + ' ' + text4 + ' ' + text2 + ' ' + text3 + '_' + amount + 'g [' + quantity + 'ea]';

      try {
        var event;
        if (startDate.getTime() === endDate.getTime()) {
          event = calendar.createAllDayEvent(title, startDate);
        } else {
          event = calendar.createAllDayEvent(title, startDate, endDate);
        }

        // 색상 ID 설정
        if (colorId) {
          event.setColor(colorId.toString());
        }

        // 설명 추가
        if (description) {
          event.setDescription(description);
        }

        sheet.getRange('L' + i).setValue(event.getId());
        sheet.getRange('A' + i).setValue('등록완료');
      } catch (e) {
        Logger.log('일정 생성 중 에러 발생: ' + e.toString());
        sheet.getRange('A' + i).setValue('오류');
      }
    } else if (status === '삭제') {
      var eventId = sheet.getRange('L' + i).getValue();

      if (eventId) {
        try {
          var event = calendar.getEventById(eventId);
          if (event) {
            event.deleteEvent();
            sheet.getRange('A' + i).setValue('삭제완료');
          } else {
            sheet.getRange('A' + i).setValue('일정없음');
          }
        } catch (e) {
          Logger.log('일정 삭제 중 에러 발생: ' + e.toString());
          sheet.getRange('A' + i).setValue('삭제오류');
        }
      }
    }
  }

  SpreadsheetApp.getUi().alert('일정 업데이트가 완료되었습니다.');
}
