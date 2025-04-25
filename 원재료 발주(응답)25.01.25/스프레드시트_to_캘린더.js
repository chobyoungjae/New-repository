function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('구매')
    .addItem('스프레드시트 → 캘린더', 'onClickShape_buy')
    .addItem('캘린더 → 스프레드시트', 'showConfirmationAndUpdate_buy')
    .addToUi();
}

function onClickShape_buy() {
 logRegularTriggerMapped("onClickShape_buy");
  const ui = SpreadsheetApp.getUi();
  const response = ui.alert('일정 업데이트', '캘린더 일정을 업데이트하시겠습니까?', ui.ButtonSet.YES_NO);
  if (response === ui.Button.YES) {
    updateBuyCalendar();
  }
}

// 🎨 색상 이름 → 캘린더 색상 ID
function getColorId(colorName) {
  const colorMap = {
    '파랑': 1,
    '초록': 2,
    '보라': 3,
    '핑크': 4,
    '노랑': 5,
    '청록': 6,
    '모르는색': 7,
    '회색': 8,
    '진한초록': 9,
    '진한빨강': 10,
    '빨강': 11
  };
  return colorMap[colorName] || null;
}

function isValidDate(d) {
  return d instanceof Date && !isNaN(d.getTime());
}

function updateBuyCalendar() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const calendarId = 'u37tatg5kaj7q6eru6m2o9vr80@group.calendar.google.com';
  const calendar = CalendarApp.getCalendarById(calendarId);
  if (!calendar) {
    SpreadsheetApp.getUi().alert('캘린더를 찾을 수 없습니다. 캘린더 ID를 확인해주세요.');
    return;
  }

  const lastRunTimeRaw = sheet.getRange('Q1').getValue();
  const lastRunTime = isValidDate(lastRunTimeRaw) ? lastRunTimeRaw : new Date(0);
  const now = new Date();
  const lastRow = sheet.getLastRow();

  for (let i = 2; i <= lastRow; i++) {
    const updateDate = sheet.getRange('A' + i).getValue();       // A열: 마지막 갱신일
    const startDate = sheet.getRange('B' + i).getValue();        // B열: 시작일
    const endDate = sheet.getRange('C' + i).getValue() || startDate; // C열: 종료일

    // ✅ B열(입고일)이 빈 칸이면 이후는 모두 비어있는 줄로 판단 → for문 종료!
    if (!startDate) break;

    if (!isValidDate(startDate)) continue;
    if (!isValidDate(endDate)) continue;
    if (isValidDate(updateDate) && updateDate <= lastRunTime) continue;

    const text1 = sheet.getRange('E' + i).getValue();            // E열
    const description = sheet.getRange('F' + i).getValue();      // F열
    const text3 = sheet.getRange('G' + i).getValue();            // G열
    const amount = sheet.getRange('H' + i).getValue();           // H열
    const rawColor = sheet.getRange('I' + i).getValue();         // I열
    const existingEventId = sheet.getRange('J' + i).getValue();  // J열
    const status = sheet.getRange('K' + i).getValue();           // K열

    const colorId = getColorId(rawColor);
    const title = text1 + ' ' + text3 + ' ' + amount + ' 입고';

    // ✅ 삭제 요청 처리
    if (status === '삭제') {
      if (existingEventId) {
        try {
          const event = calendar.getEventById(existingEventId);
          if (event) {
            event.deleteEvent();
            sheet.getRange('K' + i).setValue('삭제완료');
            sheet.getRange('J' + i).clearContent();
            sheet.getRange('A' + i).setValue(now);
          } else {
            sheet.getRange('K' + i).setValue('일정없음');
            sheet.getRange('A' + i).setValue(now);
          }
        } catch (e) {
          const errorMessage = `오류: 삭제 실패 (${i}행)`;
          Logger.log(errorMessage + ' - ' + e.toString());
          sheet.getRange('K' + i).setValue(errorMessage);
          sheet.getRange('A' + i).setValue(now);
        }
      }
      continue;
    }

    // ✅ 이미 등록된 일정
    if (existingEventId) {
      sheet.getRange('K' + i).setValue('이미 등록됨');
      continue;
    }

    // ✅ 일정 새로 등록
    try {
      let event;
      if (startDate.getTime() === endDate.getTime()) {
        event = calendar.createAllDayEvent(title, startDate, { description });
      } else {
        event = calendar.createAllDayEvent(title, startDate, endDate, { description });
      }

      if (colorId !== null) {
        try {
          event.setColor(colorId.toString());
        } catch (colorError) {
          event.deleteEvent();
          throw new Error('색상 적용 실패');
        }
      }

      sheet.getRange('J' + i).setValue(event.getId());    // eventId 저장
      sheet.getRange('K' + i).setValue('등록완료');       // 상태 기록
      sheet.getRange('A' + i).setValue(now);              // 동기화 시간

    } catch (e) {
      const errorMessage = `오류: ${e.message} (${i}행)`;
      Logger.log('일정 생성 중 에러 발생: ' + errorMessage);
      sheet.getRange('K' + i).setValue(errorMessage);
      sheet.getRange('A' + i).setValue(now);
    }
  }

  sheet.getRange('Q1').setValue(now); // 실행 완료 시간 저장
  SpreadsheetApp.getUi().alert('일정 업데이트가 완료되었습니다.');
}
