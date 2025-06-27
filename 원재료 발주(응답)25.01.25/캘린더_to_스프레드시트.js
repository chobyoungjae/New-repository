// 🎨 색상 ID → 한글 이름
function getColorNameById(colorId) {
  const colorMap = {
    1: '파랑',
    2: '초록',
    3: '보라',
    4: '핑크',
    5: '노랑',
    6: '청록',
    7: '모르는색',
    8: '회색',
    9: '진한초록',
    10: '진한빨강',
    11: '빨강',
  };
  return colorMap[String(colorId).toLowerCase()] || colorId;
}

// ✅ 버튼 클릭용 함수 (UI + 실제 로직 호출)
function showConfirmationAndUpdate_buy() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.alert(
    '캘린더 정보 동기화',
    '구글 캘린더 정보를 추적/불러오시겠습니까?',
    ui.ButtonSet.YES_NO
  );
  if (response !== ui.Button.YES) return;

  updateCalendarToSheet(); // 진짜 로직 함수 호출
}

// ✅ 공통 로직 함수 (트리거도 여기로 연결 가능, UI 없음)
function updateCalendarToSheet() {
  logRegularTriggerMapped('updateCalendarToSheet');
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getActiveSheet();
    const calendarId = sheet.getRange('A1').getValue();
    const calendar = CalendarApp.getCalendarById(calendarId);
    if (!calendar) return;

    const lastRow = sheet.getLastRow();
    const eventIds = sheet
      .getRange(3, 10, lastRow - 2)
      .getValues()
      .map(row => row[0]);
    const calendarEvents = calendar.getEvents(new Date(2000, 0, 1), new Date(2100, 0, 1));
    const calendarEventIds = calendarEvents.map(e => e.getId());

    let updatedCount = 0;

    for (let J = eventIds.length - 1; J >= 0; J--) {
      const eventId = eventIds[J];
      if (!eventId) continue;

      const row = J + 3;
      if (calendarEventIds.includes(eventId)) {
        const event = calendar.getEventById(eventId);
        if (!event) continue;

        const startTime = event.getStartTime();
        let endTime = event.getEndTime();
        if (endTime.getHours() === 0 && endTime.getMinutes() === 0 && endTime.getSeconds() === 0) {
          endTime = new Date(endTime.getTime() - 24 * 60 * 60 * 1000);
        }

        const colorName = getColorNameById(event.getColor());
        const existingStart = sheet.getRange(row, 2).getValue();
        const existingEnd = sheet.getRange(row, 3).getValue();
        const existingColor = sheet.getRange(row, 9).getValue();

        if (!(existingStart instanceof Date) || startTime.getTime() !== existingStart.getTime()) {
          sheet.getRange(row, 2).setValue(startTime);
        }
        if (!(existingEnd instanceof Date) || endTime.getTime() !== existingEnd.getTime()) {
          sheet.getRange(row, 3).setValue(endTime);
        }
        if (existingColor !== '회색' && existingColor !== colorName) {
          sheet.getRange(row, 9).setValue(colorName);
        }

        updatedCount++;
      } else {
        sheet.deleteRow(row);
      }
    }

    sheet.getRange('O1').setValue(new Date());
    Logger.log(`총 ${updatedCount}개 일정이 업데이트되었습니다.`);
  } catch (e) {
    Logger.log('캘린더 동기화 중 오류: ' + e.toString());
  }
}
