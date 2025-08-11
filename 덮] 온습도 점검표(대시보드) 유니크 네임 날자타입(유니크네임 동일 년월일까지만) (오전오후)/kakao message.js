/**
 * 온습도 점검표 카카오톡 알림 시스템
 * 평일(월~금) 11:30, 17:30에 미입력 시 오수진에게 알림 전송
 */

// 설정
const KAKAO_CONFIG = {
  TARGET_NAME: '오수진',
  TOKEN_SHEET_NAME: 'UUID',
  TOKEN_CELL: 'F1'
};

/**
 * 오전 체크 함수 (11:30 트리거용)
 * 오늘 날짜에 해당하는 데이터가 없으면 알림 전송
 */
function checkMorningEntry() {
  if (!isWeekday()) {
    Logger.log('주말이므로 체크하지 않음');
    return;
  }
  
  const today = getKoreanToday();
  const hasEntry = checkTodayEntry();
  
  if (!hasEntry) {
    const message = `⏰ 온습도 점검표 오전 입력 알림\n\n오늘(${today}) 오전 온습도 점검표가 아직 입력되지 않았습니다.\n\n입력을 부탁드립니다.`;
    sendKakaoToTarget(message);
    Logger.log(`오전 미입력 알림 전송: ${today}`);
  } else {
    Logger.log(`오전 입력 완료 확인: ${today}`);
  }
}

/**
 * 오후 체크 함수 (17:30 트리거용)
 * 오늘 날짜에 해당하는 오후 데이터가 없으면 알림 전송
 */
function checkAfternoonEntry() {
  if (!isWeekday()) {
    Logger.log('주말이므로 체크하지 않음');
    return;
  }
  
  const today = getKoreanToday();
  const hasAfternoonEntry = checkTodayAfternoonEntry();
  
  if (!hasAfternoonEntry) {
    const message = `⏰ 온습도 점검표 오후 입력 알림\n\n오늘(${today}) 오후 온습도 점검표가 아직 입력되지 않았습니다.\n\n입력을 부탁드립니다.`;
    sendKakaoToTarget(message);
    Logger.log(`오후 미입력 알림 전송: ${today}`);
  } else {
    Logger.log(`오후 입력 완료 확인: ${today}`);
  }
}

/**
 * 평일인지 확인 (월~금)
 * @return {boolean}
 */
function isWeekday() {
  const now = new Date();
  // 한국 시간으로 변환
  const koreaTime = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Seoul"}));
  const dayOfWeek = koreaTime.getDay(); // 0=일요일, 1=월요일, ..., 6=토요일
  
  return dayOfWeek >= 1 && dayOfWeek <= 5; // 월~금
}

/**
 * 한국 시간 기준 오늘 날짜 문자열 반환 (YYYY-MM-DD)
 * @return {string}
 */
function getKoreanToday() {
  const now = new Date();
  const koreaTime = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Seoul"}));
  return Utilities.formatDate(koreaTime, 'Asia/Seoul', 'yyyy-MM-dd');
}

/**
 * 오늘 날짜에 해당하는 입력이 있는지 확인
 * @return {boolean}
 */
function checkTodayEntry() {
  const ss = SpreadsheetApp.getActive();
  const dataSheet = ss.getSheetByName(CFG.DATA); // A시트
  
  if (!dataSheet) {
    Logger.log('데이터 시트를 찾을 수 없음');
    return false;
  }
  
  const today = getKoreanToday();
  const lastRow = dataSheet.getLastRow();
  
  if (lastRow < 2) return false; // 헤더만 있는 경우
  
  // A열의 타임스탬프를 확인
  for (let i = 2; i <= lastRow; i++) {
    const timestamp = dataSheet.getRange(i, 1).getValue(); // A열
    
    if (timestamp && timestamp instanceof Date) {
      const entryDate = Utilities.formatDate(timestamp, 'Asia/Seoul', 'yyyy-MM-dd');
      if (entryDate === today) {
        return true;
      }
    }
  }
  
  return false;
}

/**
 * 오늘 날짜에 해당하는 오후 입력이 있는지 확인
 * @return {boolean}
 */
function checkTodayAfternoonEntry() {
  const ss = SpreadsheetApp.getActive();
  const dataSheet = ss.getSheetByName(CFG.DATA); // A시트
  
  if (!dataSheet) {
    Logger.log('데이터 시트를 찾을 수 없음');
    return false;
  }
  
  const today = getKoreanToday();
  const lastRow = dataSheet.getLastRow();
  
  if (lastRow < 2) return false; // 헤더만 있는 경우
  
  // A열의 타임스탬프와 Q열(17)의 상태를 확인
  for (let i = 2; i <= lastRow; i++) {
    const timestamp = dataSheet.getRange(i, 1).getValue(); // A열
    const status = dataSheet.getRange(i, 17).getValue().toString().trim(); // Q열: 상태
    
    if (timestamp && timestamp instanceof Date) {
      const entryDate = Utilities.formatDate(timestamp, 'Asia/Seoul', 'yyyy-MM-dd');
      if (entryDate === today && status === '오후') {
        return true;
      }
    }
  }
  
  return false;
}

/**
 * 카카오톡 메시지를 타겟에게 전송
 * @param {string} message - 전송할 메시지
 */
function sendKakaoToTarget(message) {
  try {
    // 친구 목록에서 UUID 가져오기
    const friendMap = getFriendMap();
    const uuid = friendMap[KAKAO_CONFIG.TARGET_NAME];
    
    if (!uuid) {
      Logger.log(`❌ ${KAKAO_CONFIG.TARGET_NAME}의 UUID를 찾을 수 없음`);
      return;
    }
    
    // 액세스 토큰 가져오기
    const token = getAccessToken();
    if (!token) {
      Logger.log('❌ 액세스 토큰을 찾을 수 없음');
      return;
    }
    
    // 카카오톡 메시지 전송
    const payload = {
      receiver_uuids: JSON.stringify([uuid]),
      template_object: JSON.stringify({
        object_type: 'text',
        text: message,
        link: {
          web_url: 'https://docs.google.com/spreadsheets/d/' + SpreadsheetApp.getActive().getId(),
          mobile_web_url: 'https://docs.google.com/spreadsheets/d/' + SpreadsheetApp.getActive().getId(),
        },
        button_title: '점검표 보기',
      }),
    };
    
    const options = {
      method: 'post',
      contentType: 'application/x-www-form-urlencoded',
      headers: { Authorization: 'Bearer ' + token },
      payload: payload,
      muteHttpExceptions: true,
    };
    
    const response = UrlFetchApp.fetch(
      'https://kapi.kakao.com/v1/api/talk/friends/message/default/send',
      options
    );
    
    if (response.getResponseCode() === 200) {
      Logger.log('✅ 카카오톡 메시지 전송 성공');
    } else {
      Logger.log(`⚠️ 카카오톡 메시지 전송 실패: ${response.getResponseCode()}`);
      Logger.log(response.getContentText());
    }
    
  } catch (error) {
    Logger.log(`❌ 카카오톡 메시지 전송 중 오류: ${error.message}`);
  }
}

/**
 * 현재 스프레드시트의 UUID 시트에서 이름→UUID 매핑 객체 생성
 * @return {Object}
 */
function getFriendMap() {
  try {
    const ss = SpreadsheetApp.getActive();
    const uuidSheet = ss.getSheetByName(KAKAO_CONFIG.TOKEN_SHEET_NAME);
    const data = uuidSheet.getDataRange().getValues();
    const map = {};
    
    // 헤더 행을 찾아서 이름과 UUID 컬럼 위치 확인
    let nameCol = -1, uuidCol = -1;
    for (let j = 0; j < data[0].length; j++) {
      if (data[0][j] === '이름') nameCol = j;
      if (data[0][j] === 'UUID') uuidCol = j;
    }
    
    if (nameCol === -1 || uuidCol === -1) {
      Logger.log('❌ UUID 시트에서 이름 또는 UUID 컬럼을 찾을 수 없음');
      return {};
    }
    
    // 데이터 행에서 이름→UUID 매핑 생성
    for (let i = 1; i < data.length; i++) {
      const name = data[i][nameCol];
      const uuid = data[i][uuidCol];
      if (name && uuid) {
        map[name.toString().trim()] = uuid.toString().trim();
      }
    }
    
    return map;
  } catch (error) {
    Logger.log(`❌ 친구 목록 로드 중 오류: ${error.message}`);
    return {};
  }
}

/**
 * 액세스 토큰 가져오기
 * @return {string}
 */
function getAccessToken() {
  try {
    const ss = SpreadsheetApp.getActive();
    const tokenSheet = ss.getSheetByName(KAKAO_CONFIG.TOKEN_SHEET_NAME);
    
    if (!tokenSheet) {
      Logger.log('토큰 시트를 찾을 수 없음');
      return null;
    }
    
    return tokenSheet.getRange(KAKAO_CONFIG.TOKEN_CELL).getValue();
  } catch (error) {
    Logger.log(`❌ 액세스 토큰 가져오기 중 오류: ${error.message}`);
    return null;
  }
}

/**
 * 테스트 함수 - 수동 실행용
 */
function testMorningCheck() {
  Logger.log('=== 오전 체크 테스트 ===');
  checkMorningEntry();
}

function testAfternoonCheck() {
  Logger.log('=== 오후 체크 테스트 ===');
  checkAfternoonEntry();
}

/**
 * 트리거 설정 함수 (수동 실행)
 * 평일 11:30과 17:30에 실행되는 트리거 생성
 */
function setupTriggers() {
  // 기존 트리거 삭제
  ScriptApp.getProjectTriggers().forEach(trigger => {
    if (trigger.getHandlerFunction() === 'checkMorningEntry' || 
        trigger.getHandlerFunction() === 'checkAfternoonEntry') {
      ScriptApp.deleteTrigger(trigger);
    }
  });
  
  // 오전 11:30 트리거
  ScriptApp.newTrigger('checkMorningEntry')
    .timeBased()
    .everyDays(1)
    .atHour(11)
    .nearMinute(30)
    .create();
  
  // 오후 17:30 트리거  
  ScriptApp.newTrigger('checkAfternoonEntry')
    .timeBased()
    .everyDays(1)
    .atHour(17)
    .nearMinute(30)
    .create();
    
  Logger.log('트리거 설정 완료 (오전 11:30, 오후 17:30)');
}