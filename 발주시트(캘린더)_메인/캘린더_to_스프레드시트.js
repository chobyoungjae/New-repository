function showConfirmationAndUpdate() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.alert(
    '캘린더 정보 동기화',
    '구글 캘린더 정보를 추적/불러오시겠습니까?',
    ui.ButtonSet.YES_NO
  );

  if (response == ui.Button.YES) {
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
      const eventIdsRange = sheet.getRange(3, 12, lastRow - 2); // L열 (12번째 열), 3행부터 추출
      const eventIds = eventIdsRange.getValues().map(row => row[0]?.toString().trim());
      const calendarEvents = calendar.getEvents(new Date(2000, 0, 1), new Date(2100, 0, 1));
      const calendarEventIds = calendarEvents.map(event => event.getId().trim());

      let updatedCount = 0;

      for (let i = eventIds.length - 1; i >= 0; i--) {
        const eventId = eventIds[i];

        if (eventId) {
          if (calendarEventIds.includes(eventId)) {
            const event = calendar.getEventById(eventId);
            if (event) {
              const startTime = event.getStartTime();
              let endTime = event.getEndTime();
              const description = (event.getDescription() || "").trim(); // null-safe 및 트림 처리

              // 하루종일 이벤트의 종료 시간 보정
              if (endTime.getHours() === 0 && endTime.getMinutes() === 0 && endTime.getSeconds() === 0) {
                endTime = new Date(endTime.getTime() - 24 * 60 * 60 * 1000);
              }

              const color = event.getColor();
              const row = i + 3;

              let currentStartTime = sheet.getRange(row, 2).getValue();
              let currentEndTime = sheet.getRange(row, 3).getValue();
              const currentColor = sheet.getRange(row, 10).getValue();
              const currentDescription = (sheet.getRange(row, 11).getValue() || "").trim(); // null-safe 및 트림 처리

              if (!(currentStartTime instanceof Date)) {
                currentStartTime = new Date(currentStartTime);
              }
              if (!(currentEndTime instanceof Date)) {
                currentEndTime = new Date(currentEndTime);
              }

              const isStartTimeChanged = currentStartTime.getTime() !== startTime.getTime();
              const isEndTimeChanged = currentEndTime.getTime() !== endTime.getTime();
              const isColorChanged = currentColor !== color;
              const isDescriptionChanged = currentDescription !== description;

              if (isStartTimeChanged || isEndTimeChanged || isColorChanged || isDescriptionChanged) {
                if (isStartTimeChanged) {
                  sheet.getRange(row, 2).setValue(startTime);
                }
                if (isEndTimeChanged) {
                  sheet.getRange(row, 3).setValue(endTime);
                }
                if (isColorChanged) {
                  sheet.getRange(row, 10).setValue(color);
                }
                if (isDescriptionChanged) {
                  sheet.getRange(row, 11).setValue(description);
                }
                updatedCount++;
              }
            }
          } else {
            const rowToDelete = i + 3;
            sheet.deleteRow(rowToDelete);
          }
        }
      }

      ui.alert(
        '동기화 완료',
        `총 ${updatedCount}개의 일정이 업데이트되었으며, 삭제된 일정이 반영되었습니다.`,
        ui.ButtonSet.OK
      );
    } catch (error) {
      ui.alert('오류 발생', '동기화 중 오류가 발생했습니다: ' + error.toString(), ui.ButtonSet.OK);
    }
  }
}
