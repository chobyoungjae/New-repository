/**
 * 설치형 onEdit 트리거용 핸들러
 * (간단 트리거는 제거하고, 이 함수만 설치형 트리거로 연결하세요)
 */
function handleEditTrigger(e) {
  const range = e.range;
  const sheet = range.getSheet();

  // P열(16) / 값이 '이경진' / 아직 S열(19)이 비어있을 때만
  if (range.getColumn() !== 16) return;
  if (e.value !== '이경진') return;
  const row = range.getRow();
  const status = sheet.getRange(row, 19).getValue();
  if (status) return;

  const ui = SpreadsheetApp.getUi();
  const resp = ui.alert('캘린더로 업데이트', '캘린더로 업데이트하시겠습니까?', ui.ButtonSet.YES_NO);
  if (resp !== ui.Button.YES) {
    ui.alert('작업이 취소되었습니다.');
    return;
  }

  updateRowInCalendar(sheet, row);
  ui.alert('업데이트가 완료되었습니다.');
}

/**
 * 단일 행(row)을 캘린더에 등록하고 R/S열에 기록
 */
function updateRowInCalendar(sheet, row) {
  const calendarId = '9kf8p682c4btht0q6agroi9r5c@group.calendar.google.com';
  const cal = CalendarApp.getCalendarById(calendarId);
  if (!cal) {
    SpreadsheetApp.getUi().alert('캘린더를 찾을 수 없습니다.');
    return;
  }

  const startDate = sheet.getRange(row, 7).getValue(); // G
  const endDate = sheet.getRange(row, 8).getValue(); // H
  const text1 = sheet.getRange(row, 2).getValue(); // B
  const text2 = sheet.getRange(row, 6).getValue(); // F
  const text3 = sheet.getRange(row, 3).getValue(); // C
  const description = sheet.getRange(row, 10).getValue(); // J
  const team = sheet.getRange(row, 5).getValue(); // E

  if (!(startDate instanceof Date)) {
    sheet.getRange(row, 18).setValue('시작일 오류');
    return;
  }
  if (!(endDate instanceof Date)) {
    sheet.getRange(row, 18).setValue('종료일 오류');
    return;
  }

  let eventExists = false;
  let eventId = sheet.getRange(row, 19).getValue(); // S
  if (eventId) {
    try {
      if (eventId.indexOf('@') === -1) eventId += '@google.com';
      const ev = cal.getEventById(eventId);
      if (ev) {
        sheet.getRange(row, 18).setValue('이미 등록됨');
        return;
      }
    } catch (err) {
      sheet.getRange(row, 18).setValue('조회 오류');
      return;
    }
  }

  try {
    const title = `${text1} ${text2} ${text3}`;
    const color = getColorId(team);
    const adjEnd = new Date(endDate.getTime() + 24 * 60 * 60 * 1000);
    const newEv =
      startDate.getTime() === endDate.getTime()
        ? cal.createAllDayEvent(title, startDate)
        : cal.createAllDayEvent(title, startDate, adjEnd);
    newEv.setDescription(description);
    newEv.setColor(color);

    sheet.getRange(row, 19).setValue(newEv.getId()); // S
    sheet.getRange(row, 18).setValue('등록완료'); // R
  } catch (err) {
    sheet.getRange(row, 18).setValue('오류: ' + err.message);
  }
}

function getColorId(team) {
  switch (team) {
    case '생산팀':
      return '9';
    case '품질팀':
      return '11';
    case '영업팀':
      return '10';
    case '마케팅팀':
      return '5';
    case '물류팀':
      return '3';
    default:
      return '8';
  }
}
