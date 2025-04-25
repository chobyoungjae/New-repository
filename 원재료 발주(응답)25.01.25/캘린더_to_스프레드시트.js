// 🎨 색상 ID → 한글 이름
function getColorNameById(colorId) {
  const colorMap = {
    '1': '파랑',
    '2': '초록',
    '3': '보라',
    '4': '핑크',
    '5': '노랑',
    '6': '청록',
    '7': '모르는색',
    '8': '회색',
    '9': '진한초록',
    '10': '진한빨강',
    '11': '빨강',
  };
  return colorMap[String(colorId).toLowerCase()] || colorId;
}

// 📥 구글 캘린더 → 시트 동기화 (구매용)
function showConfirmationAndUpdate_buy() {
  logRegularTriggerMapped("showConfirmationAndUpdate_buy");
  
  const ui = SpreadsheetApp.getUi();
  const response = ui.alert(
    '캘린더 정보 동기화',
    '구글 캘린더 정보를 추적/불러오시겠습니까?',
    ui.ButtonSet.YES_NO
  );

  if (response !== ui.Button.YES) return;

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getActiveSheet();
    const calendarId = sheet.getRange("A1").getValue();
    const calendar = CalendarApp.getCalendarById(calendarId);

    if (!calendar) {
      ui.alert('캘린더를 찾을 수 없습니다. 캘린더 ID를 확인해주세요.', ui.ButtonSet.OK);
      return;
    }

    const lastRow = sheet.getLastRow();
    const eventIdsRange = sheet.getRange(3, 10, lastRow - 2); // J열 (eventId)
    const eventIds = eventIdsRange.getValues().map(row => row[0]);
    const calendarEvents = calendar.getEvents(new Date(2000, 0, 1), new Date(2100, 0, 1));
    const calendarEventIds = calendarEvents.map(event => event.getId());

    let updatedCount = 0;

    for (let J = eventIds.length - 1; J >= 0; J--) {
      const eventId = eventIds[J];
      if (!eventId) continue;

      if (calendarEventIds.includes(eventId)) {
        const event = calendar.getEventById(eventId);
        if (!event) continue;

        const startTime = event.getStartTime();
        let endTime = event.getEndTime();
        if (
          endTime.getHours() === 0 &&
          endTime.getMinutes() === 0 &&
          endTime.getSeconds() === 0
        ) {
          endTime = new Date(endTime.getTime() - 24 * 60 * 60 * 1000);
        }

        const colorId = event.getColor();
        const colorName = getColorNameById(colorId);
        const row = J + 3;

        const existingStart = sheet.getRange(row, 2).getValue(); // B열
        const existingEnd = sheet.getRange(row, 3).getValue();   // C열
        const existingColor = sheet.getRange(row, 9).getValue(); // I열

        const isStartChanged = !(existingStart instanceof Date) || startTime.getTime() !== existingStart.getTime();
        const isEndChanged = !(existingEnd instanceof Date) || endTime.getTime() !== existingEnd.getTime();

        // ✅ "스프레드시트의 기존 값이 '회색'이면 색상은 비교/업데이트 안 함"
        let isColorChanged = false;
        if (existingColor !== '회색') {
          isColorChanged = existingColor !== colorName;
        }

        if (isStartChanged) sheet.getRange(row, 2).setValue(startTime);
        if (isEndChanged) sheet.getRange(row, 3).setValue(endTime);
        if (isColorChanged) sheet.getRange(row, 9).setValue(colorName);

        if (isStartChanged || isEndChanged || isColorChanged) {
          updatedCount++;
        }
      } else {
        const rowToDelete = J + 3;
        sheet.deleteRow(rowToDelete);
      }
    }

    sheet.getRange('O1').setValue(new Date()); // 마지막 동기화 시간 기록

    ui.alert(
      '동기화 완료',
      `총 ${updatedCount}개의 일정이 업데이트되었으며,\n삭제된 일정이 반영되었습니다.`,
      ui.ButtonSet.OK
    );
  } catch (error) {
    ui.alert('오류 발생', '동기화 중 오류가 발생했습니다:\n' + error.toString(), ui.ButtonSet.OK);
  }
}
