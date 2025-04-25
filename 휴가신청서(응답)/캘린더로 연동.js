/**
 * 트리거 대시보드용 백데이터 (문서 ID 기준 기록)
 *
 * @param {string} docId - '정기 트리거 상태' 시트 B열의 문서 ID
 */
function logRegularTriggerMapped(docId) {
  var dashboard = SpreadsheetApp.openById("1YMH0u-NRghspwapeczB-siQPs022f3H2EFVp7tPX31s");
  var sheet     = dashboard.getSheetByName("정기 트리거 상태");
  var data      = sheet.getDataRange().getValues();
  var now       = new Date();

  // B열 문서 ID가 docId와 일치하고, E열(status)가 비어있는 첫 행에만 기록
  for (var i = 1; i < data.length; i++) {
    var rowDocId = data[i][1];  // B열: 문서 ID
    var status   = data[i][4];  // E열: 상태
    if (rowDocId === docId && !status) {
      sheet.getRange(i + 1, 5).setValue("✅ 실행됨"); // E열: 작동유무
      sheet.getRange(i + 1, 6).setValue(now);         // F열: 실행 시간
      return;
    }
  }
}

function onClickShape() {
  var ui = SpreadsheetApp.getUi();
  var response = ui.alert('일정 업데이트', '정말로 일정을 업데이트하시겠습니까?', ui.ButtonSet.YES_NO);

  if (response == ui.Button.YES) {
    updateProductionCalendar();
  } else {
    ui.alert('작업이 취소되었습니다.');
  }
}

function updateProductionCalendar() {
  var sheet = SpreadsheetApp.getActiveSheet();
  var calendarId = '9kf8p682c4btht0q6agroi9r5c@group.calendar.google.com';
  var calendar = CalendarApp.getCalendarById(calendarId);

  if (!calendar) {
    SpreadsheetApp.getUi().alert('캘린더를 찾을 수 없습니다. 캘린더 ID를 확인해주세요.');
    return;
  }

  // Z1 셀에 저장된 기준 날짜시간 가져오기
  var dateCell = sheet.getRange('Z1').getValue();
  var targetDate = (dateCell instanceof Date) ? dateCell : new Date(2025, 0, 1); // 기본값

  var lastRow = sheet.getRange('A:A').getValues().filter(String).length;

  for (var i = 2; i <= lastRow; i++) {
    var timestamp = sheet.getRange('A' + i).getValue();
    if (!(timestamp instanceof Date) || timestamp <= targetDate) {
      continue;
    }

    var conditionCheck = sheet.getRange('P' + i).getValue();
    if (conditionCheck !== '이경진') {
      sheet.getRange('R' + i).setValue('조건 불충족 (P열 값: ' + conditionCheck + ')');
      continue;
    }

    var eventId = sheet.getRange('S' + i).getValue();
    var startDate = sheet.getRange('G' + i).getValue();
    var endDate = sheet.getRange('H' + i).getValue();
    var text1 = sheet.getRange('B' + i).getValue();
    var text2 = sheet.getRange('F' + i).getValue();
    var text3 = sheet.getRange('C' + i).getValue();
    var description = sheet.getRange('J' + i).getValue();
    var team = sheet.getRange('E' + i).getValue();

    if (!startDate || !(startDate instanceof Date)) {
      sheet.getRange('R' + i).setValue('시작일 오류');
      continue;
    }
    if (!endDate || !(endDate instanceof Date)) {
      sheet.getRange('R' + i).setValue('종료일 오류');
      continue;
    }

    var title = `${text1} ${text2} ${text3}`;
    var colorId = getColorId(team);
    var adjustedEnd = new Date(endDate.getTime() + 24 * 60 * 60 * 1000);

    var eventExists = false;
    if (eventId) {
      try {
        if (eventId.indexOf('@') === -1) {
          eventId += '@google.com'; // 보완
        }
        var event = calendar.getEventById(eventId);
        if (event) {
          eventExists = true;
          sheet.getRange('R' + i).setValue('이미 등록됨');
        } else {
          sheet.getRange('R' + i).setValue('삭제됨');
        }
      } catch (e) {
        sheet.getRange('R' + i).setValue('이벤트 조회 오류: ' + e.message);
        continue;
      }
    }

    if (!eventExists) {
      try {
        var newEvent;
        if (startDate.getTime() === endDate.getTime()) {
          newEvent = calendar.createAllDayEvent(title, startDate);
        } else {
          newEvent = calendar.createAllDayEvent(title, startDate, adjustedEnd);
        }

        newEvent.setDescription(description);
        newEvent.setColor(colorId);
        sheet.getRange('S' + i).setValue(newEvent.getId());
        sheet.getRange('R' + i).setValue('등록완료');

      } catch (e) {
        Logger.log('일정 생성 중 오류: ' + e.toString());
        sheet.getRange('R' + i).setValue('오류: ' + e.message);
      }
    }
  }

  // 마지막 업데이트 시간 Z1에 기록
  sheet.getRange('Z1').setValue(new Date());

  SpreadsheetApp.getUi().alert('일정 업데이트가 완료되었습니다.');
}

function getColorId(team) {
  switch (team) {
    case '생산팀': return '9';   // 파랑
    case '품질팀': return '11';  // 빨강
    case '영업팀': return '10';  // 초록
    case '마케팅팀': return '5'; // 노랑
    case '물류팀': return '3';   // 보라
    default: return '8';         // 회색 (기본)
  }
}
