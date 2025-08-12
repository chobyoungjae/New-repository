// 카카오톡 쿨타임 설정 (10분)
var KAKAO_COOLDOWN = 10 * 60 * 1000; // 10분 (밀리초)

/**
 * 설치 가능한 트리거 함수 (권한 문제 해결)
 */
function onEditInstallable(e) {
  var sheet = e.source.getActiveSheet();
  var range = e.range;

  // '기본데이터' 시트에서만 작동
  if (sheet.getName() !== '기본데이터') {
    return;
  }

  // 범위 제한 확인
  if (!isValidEditRange(range)) {
    console.log('편집 범위가 제한 구역입니다. 이력 및 알림을 무시합니다.');
    return;
  }

  // 변경 이력 기록
  logDataChange(e);

  // 카카오톡 알림 발송 (10분 쿨타임 적용, 변경 정보 포함)
  sendKakaoNotification(e);
}

// onEdit 단순 트리거 제거 - onEditInstallable만 사용

/**
 * 편집 범위가 유효한지 확인하는 함수
 * 조건: 232행 이후는 제외, R열(18열) 이후는 제외
 */
function isValidEditRange(range) {
  var row = range.getRow();
  var column = range.getColumn();

  // 232행 이후는 제외
  if (row >= 232) {
    return false;
  }

  // R열(18열) 이후는 제외 (A=1, B=2, ..., Q=17, R=18)
  if (column >= 18) {
    return false;
  }

  return true;
}

/**
 * 데이터 변경 이력을 '데이터 변경 이력' 시트에 기록
 */
function logDataChange(e) {
  try {
    var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    var logSheet = spreadsheet.getSheetByName('데이터 변경 이력');

    // '데이터 변경 이력' 시트가 없으면 생성
    if (!logSheet) {
      logSheet = spreadsheet.insertSheet('데이터 변경 이력');
      // 헤더 설정
      logSheet
        .getRange(1, 1, 1, 5)
        .setValues([['타임스탬프', '셀 위치', '변경전 내용', '변경후 내용', '카톡발송시간']]);
    }

    // 현재 시간 (Date 객체로 저장)
    var timestamp = new Date();

    var range = e.range;
    var numRows = range.getNumRows();
    var numCols = range.getNumColumns();
    var startRow = range.getRow();
    var startCol = range.getColumn();
    
    // 변경 전 값들 (oldValues가 있는 경우)
    var oldValues = e.oldValues || [];
    // 변경 후 값들
    var newValues = range.getValues();

    // 각 셀별로 개별 기록
    for (var r = 0; r < numRows; r++) {
      for (var c = 0; c < numCols; c++) {
        var cellRow = startRow + r;
        var cellCol = startCol + c;
        
        // 개별 셀 주소 생성 (예: O27, O28, O29)
        var cellAddress = range.getCell(r + 1, c + 1).getA1Notation();
        
        // 변경 전 내용
        var oldValue = '';
        if (oldValues && oldValues[r] && oldValues[r][c] !== undefined) {
          oldValue = oldValues[r][c];
        } else if (e.oldValue !== undefined && numRows === 1 && numCols === 1) {
          oldValue = e.oldValue;
        }
        
        // 변경 후 내용
        var newValue = newValues[r][c] || '';
        
        // 마지막 행 찾기
        var lastRow = logSheet.getLastRow();
        
        // 새 행에 데이터 추가 (E열은 나중에 카톡 발송시 업데이트)
        var newRow = lastRow + 1;
        logSheet
          .getRange(newRow, 1, 1, 5)
          .setValues([[timestamp, cellAddress, oldValue, newValue, '']]);
        
        // A열 날짜 형식 설정
        logSheet.getRange(newRow, 1).setNumberFormat('yy.mm.dd hh:mm:ss');
        
        console.log('변경 이력 기록:', { timestamp, cellAddress, oldValue, newValue });
      }
    }
    
  } catch (error) {
    console.error('변경 이력 기록 중 오류:', error);
  }
}

/**
 * UUID 시트에서 사용자 정보 가져오기
 */
function getUsersFromUUIDSheet() {
  try {
    var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    var uuidSheet = spreadsheet.getSheetByName('UUID');

    if (!uuidSheet) {
      console.error('UUID 시트를 찾을 수 없습니다.');
      return [];
    }

    var users = [];
    var lastRow = uuidSheet.getLastRow();

    // 2행부터 데이터 확인 (1행은 헤더)
    for (var i = 2; i <= lastRow; i++) {
      var name = uuidSheet.getRange(i, 1).getValue(); // A열: 이름
      var uuid = uuidSheet.getRange(i, 2).getValue(); // B열: UUID
      var accessToken = uuidSheet.getRange(i, 4).getValue(); // D열: 액세스 토큰

      // 강정호, 오수진만 대상
      if (name === '강정호' || name === '오수진') {
        users.push({
          name: name,
          uuid: uuid,
          accessToken: accessToken,
        });
      }
    }

    return users;
  } catch (error) {
    console.error('사용자 정보 조회 중 오류:', error);
    return [];
  }
}

/**
 * 카카오톡 메시지 발송 (10분 쿨타임 적용)
 */
function sendKakaoNotification(editEvent) {
  try {
    var currentTime = new Date();
    
    // 데이터 변경 이력 시트에서 마지막 카톡 발송 시간 확인
    var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    var logSheet = spreadsheet.getSheetByName('데이터 변경 이력');
    
    if (logSheet) {
      var lastRow = logSheet.getLastRow();
      
      // E열(카톡발송시간)에서 가장 최근 발송 시간 찾기
      for (var i = lastRow; i >= 2; i--) {
        var kakaoSentTimeCell = logSheet.getRange(i, 5);
        var kakaoSentTime = kakaoSentTimeCell.getValue();
        
        if (kakaoSentTime) {
          console.log('발견된 카톡 발송 시간 타입:', typeof kakaoSentTime);
          console.log('발견된 카톡 발송 시간 값:', kakaoSentTime);
          
          // Date 객체로 변환 시도
          var lastSentDate;
          if (kakaoSentTime instanceof Date) {
            lastSentDate = kakaoSentTime;
          } else {
            // 텍스트인 경우 Date로 변환
            lastSentDate = new Date(kakaoSentTime);
          }
          
          console.log('변환된 날짜:', lastSentDate);
          console.log('현재 시간:', currentTime);
          
          var timeDiff = currentTime.getTime() - lastSentDate.getTime();
          console.log('시간 차이(밀리초):', timeDiff);
          console.log('쿨타임 기준(밀리초):', KAKAO_COOLDOWN);
          
          if (timeDiff < KAKAO_COOLDOWN && !isNaN(lastSentDate.getTime())) {
            console.log('카카오톡 쿨타임 중입니다. 마지막 발송:', lastSentDate);
            console.log('남은 시간:', Math.ceil((KAKAO_COOLDOWN - timeDiff) / 1000 / 60) + '분');
            return;
          }
          break; // 가장 최근 발송 시간만 확인
        }
      }
    }

    var users = getUsersFromUUIDSheet();
    if (users.length === 0) {
      console.log('발송 대상 사용자가 없습니다.');
      return;
    }

    // PC와 모바일 모두 커스텀 URL 사용
    var targetUrl = 'https://kakao-test-ebon.vercel.app/go.html?doc=생산메인화면';

    // 변경 정보를 포함한 메시지 생성
    var changeInfo = generateChangeInfo(editEvent);

    // 각 사용자에게 메시지 발송
    users.forEach(function (user) {
      sendKakaoMessage(user, targetUrl, changeInfo);
    });

    // 이력 시트 E열에 카톡 발송 시간 기록
    updateKakaoSentTime(currentTime);
    
  } catch (error) {
    console.error('카카오톡 알림 발송 중 오류:', error);
  }
}

/**
 * 변경 정보를 문자열로 생성
 */
function generateChangeInfo(editEvent) {
  try {
    if (!editEvent) return '';
    
    var range = editEvent.range;
    var numRows = range.getNumRows();
    var numCols = range.getNumColumns();
    
    // 변경 전 값들
    var oldValues = editEvent.oldValues || [];
    // 변경 후 값들
    var newValues = range.getValues();
    
    var changeDetails = [];
    
    // 각 셀별로 변경 정보 생성
    for (var r = 0; r < numRows; r++) {
      for (var c = 0; c < numCols; c++) {
        var cellAddress = range.getCell(r + 1, c + 1).getA1Notation();
        
        // 변경 전 내용
        var oldValue = '';
        if (oldValues && oldValues[r] && oldValues[r][c] !== undefined) {
          oldValue = oldValues[r][c];
        } else if (editEvent.oldValue !== undefined && numRows === 1 && numCols === 1) {
          oldValue = editEvent.oldValue;
        }
        
        // 변경 후 내용
        var newValue = newValues[r][c] || '';
        
        // 변경된 내용만 추가 (빈 값 변경도 포함)
        var detail = "변경된셀위치:" + cellAddress + "\n변경전:" + oldValue + "\n변경후:" + newValue;
        changeDetails.push(detail);
      }
    }
    
    // 최대 3개 셀까지만 표시 (메시지 길이 제한)
    if (changeDetails.length > 3) {
      return changeDetails.slice(0, 3).join('\n\n') + '\n\n외 ' + (changeDetails.length - 3) + '개 셀 변경';
    } else {
      return changeDetails.join('\n\n');
    }
    
  } catch (error) {
    console.error('변경 정보 생성 중 오류:', error);
    return '';
  }
}

/**
 * 데이터 변경 이력 시트의 E열에 카톡 발송 시간 기록
 */
function updateKakaoSentTime(sentTime) {
  try {
    var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    var logSheet = spreadsheet.getSheetByName('데이터 변경 이력');
    
    if (logSheet) {
      var lastRow = logSheet.getLastRow();
      
      // Date 객체로 직접 저장 (날짜 형식)
      var kakaoTimeCell = logSheet.getRange(lastRow, 5);
      kakaoTimeCell.setValue(sentTime);
      
      // 날짜 형식으로 표시 설정
      kakaoTimeCell.setNumberFormat('yy.mm.dd hh:mm:ss');
      
      console.log('카톡 발송 시간 기록:', sentTime);
    }
  } catch (error) {
    console.error('카톡 발송 시간 기록 중 오류:', error);
  }
}

/**
 * 개별 사용자에게 카카오톡 메시지 발송
 */
function sendKakaoMessage(user, targetUrl, changeInfo) {
  try {
    var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    var uuidSheet = spreadsheet.getSheetByName('UUID');
    var senderAccessToken = uuidSheet.getRange('F1').getValue(); // F1셀의 액세스 토큰

    if (!senderAccessToken) {
      console.error('발송자 액세스 토큰을 찾을 수 없습니다.');
      return;
    }

    // 메시지 텍스트 생성
    var messageText = '기본데이터 시트가 변경되었습니다.';
    if (changeInfo) {
      messageText += '\n\n' + changeInfo;
    }

    // 카카오톡 메시지 템플릿 (변경 정보 포함)
    var templateObject = {
      object_type: 'text',
      text: messageText,
      link: {
        web_url: targetUrl,
        mobile_web_url: targetUrl,
      },
      button_title: '시트 확인하기',
    };

    // API 호출 파라미터 (과거 코드 방식)
    var payload = {
      receiver_uuids: JSON.stringify([user.uuid]),
      template_object: JSON.stringify(templateObject),
    };

    var options = {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + senderAccessToken,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      payload: payload,
      muteHttpExceptions: true,
    };

    var response = UrlFetchApp.fetch(
      'https://kapi.kakao.com/v1/api/talk/friends/message/default/send',
      options
    );
    var responseData = JSON.parse(response.getContentText());

    if (
      responseData.successful_receiver_uuids &&
      responseData.successful_receiver_uuids.length > 0
    ) {
      console.log(user.name + '에게 카카오톡 메시지 발송 성공');
    } else {
      console.error(user.name + '에게 카카오톡 메시지 발송 실패:', responseData);
    }
  } catch (error) {
    console.error(user.name + '에게 카카오톡 메시지 발송 중 오류:', error);
  }
}

/**
 * 설치 가능한 편집 트리거 설정 (카카오톡 알림 포함)
 */
function setupInstallableTrigger() {
  try {
    // 기존 트리거 제거
    var triggers = ScriptApp.getProjectTriggers();
    triggers.forEach(function (trigger) {
      if (trigger.getHandlerFunction() === 'onEditInstallable') {
        ScriptApp.deleteTrigger(trigger);
      }
    });

    // 새 설치 가능한 트리거 생성 (올바른 방법)
    var trigger = ScriptApp.newTrigger('onEditInstallable').onEdit().create();

    console.log('설치 가능한 편집 트리거 설정 완료');
    console.log('트리거 ID:', trigger.getUniqueId());
    console.log('이제 카카오톡 알림이 정상 작동합니다.');
  } catch (error) {
    console.error('트리거 설정 중 오류:', error);

    // 수동 트리거 설정 안내
    console.log('수동 설정 방법:');
    console.log('1. Apps Script 편집기 왼쪽 메뉴에서 "트리거" 클릭');
    console.log('2. "+ 트리거 추가" 클릭');
    console.log('3. 함수: onEditInstallable 선택');
    console.log('4. 이벤트 소스: 스프레드시트에서 선택');
    console.log('5. 이벤트 유형: 편집 시 선택');
    console.log('6. 저장 클릭');
  }
}

/**
 * 초기화 함수 (필요시 실행)
 */
function initialize() {
  console.log('초기화 완료');

  // 테스트용 - 현재 스프레드시트 정보 확인
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  console.log('스프레드시트 이름:', spreadsheet.getName());
  console.log('스프레드시트 URL:', spreadsheet.getUrl());
}

/**
 * 권한 테스트 함수 - 이 함수를 먼저 실행해서 권한을 승인받으세요
 */
function authorizePermissions() {
  try {
    // UrlFetchApp 권한 테스트
    console.log('권한 테스트 시작...');

    // 간단한 HTTP 요청으로 권한 확인
    var response = UrlFetchApp.fetch('https://httpbin.org/get');
    console.log('UrlFetchApp 권한 승인 완료');

    // 스프레드시트 권한 확인
    var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    console.log('스프레드시트 권한 승인 완료');
    console.log('모든 권한이 정상적으로 승인되었습니다.');
  } catch (error) {
    console.error('권한 승인 필요:', error);
  }
}

/**
 * 테스트 함수
 */
function testKakaoMessage() {
  var targetUrl = 'https://kakao-test-ebon.vercel.app/go.html?doc=생산메인화면';
  var users = getUsersFromUUIDSheet();
  
  // 테스트용 변경 정보
  var testChangeInfo = "변경된셀위치:A1\n변경전:이전값\n변경후:새로운값";

  console.log('테스트 - 사용자 목록:', users);
  console.log('테스트 - 타겟 URL:', targetUrl);

  if (users.length > 0) {
    sendKakaoMessage(users[0], targetUrl, testChangeInfo);
  }
}
