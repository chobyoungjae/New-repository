/**
 * 0) 카카오 토큰 읽기 & 알림 함수
 */
function getKakaoToken() {
  return SpreadsheetApp.getActive().getSheetByName('카카오친구목록').getRange('F1').getValue();
}

function sendErrorAlert(title, message) {
  // 카카오톡 메시지
  var token = getKakaoToken();
  var kakaoUrl = 'https://kapi.kakao.com/v2/api/talk/memo/default/send';
  var template = {
    object_type: 'text',
    text: '[' + title + ']\n' + message,
  };
  UrlFetchApp.fetch(kakaoUrl, {
    method: 'post',
    headers: { Authorization: 'Bearer ' + token },
    payload: { template_object: JSON.stringify(template) },
    muteHttpExceptions: true,
  });
  // 이메일 발송
  MailApp.sendEmail('oosdream3@gmail.com', title, message);
}

// 2) 테스트용으로 이 함수만 ▶️ 눌러 실행
function testSendErrorAlert() {
  var title = '테스트 알림';
  var message = '이 메시지가 카카오톡으로도 가는지 확인합니다.';
  var res = sendErrorAlert(title, message);
  // (선택) 리턴 객체도 로그로
  Logger.log(res);
}

// 🔍 세션 로그인 디버깅 전용 함수
function testLoginDebug() {
  console.log('=== 세션 로그인 테스트 시작 ===');
  const sessionId = loginToEcountWithOfficialKey();
  if (sessionId) {
    console.log('✅ 성공! 세션 ID:', sessionId);
  } else {
    console.log('❌ 실패! 세션 ID를 받지 못했습니다.');
    console.log('위 로그에서 "로그인 응답 전문"을 확인하세요.');
  }
  console.log('=== 테스트 종료 ===');
}

/**
 * 트리거 대시보드용 백데이터 (문서 ID 기준 기록)
 */
function logRegularTriggerMapped(docId) {
  var dashboard = SpreadsheetApp.openById('1YMH0u-NRghspwapeczB-siQPs022f3H2EFVp7tPX31s');
  var sheet = dashboard.getSheetByName('정기 트리거 상태');
  var data = sheet.getDataRange().getValues();
  var now = new Date();
  for (var i = 1; i < data.length; i++) {
    if (data[i][1] === docId && !data[i][4]) {
      sheet.getRange(i + 1, 5).setValue('✅ 실행됨');
      sheet.getRange(i + 1, 6).setValue(now);
      return;
    }
  }
}

// 1) 로그인 → 세션 ID 반환
function loginToEcountWithOfficialKey() {
  const apiUrl = 'https://oapiCB.ecount.com/OAPI/V2/OAPILogin';
  const payload = {
    COM_CODE: '606274',
    USER_ID: 'OOSDREAM',
    API_CERT_KEY: '1b633bde6273d4ce2ae69e3b357e41eda0',
    LAN_TYPE: 'ko-KR',
    ZONE: 'CB',
  };

  try {
    const res = UrlFetchApp.fetch(apiUrl, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
    });

    const statusCode = res.getResponseCode();
    if (statusCode !== 200) {
      return null;
    }

    const j = JSON.parse(res.getContentText());

    // 응답의 Status가 숫자 200 또는 문자열 "200" 둘 다 체크
    if ((j.Status === 200 || j.Status === '200') && j.Data && j.Data.Datas && j.Data.Datas.SESSION_ID) {
      return j.Data.Datas.SESSION_ID;
    } else {
      return null;
    }
  } catch (e) {
    return null;
  }
}

// 2) 단건 품목코드 → 제품명 조회
function getProductName(sessionId, prodCd) {
  const apiUrl = `https://oapiCB.ecount.com/OAPI/V2/InventoryBasic/ViewBasicProduct?SESSION_ID=${sessionId}`;
  const res = UrlFetchApp.fetch(apiUrl, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({ PROD_CD: prodCd }),
    muteHttpExceptions: true,
  });
  if (res.getResponseCode() !== 200) return '';
  try {
    const j = JSON.parse(res.getContentText());
    return j.Status === '200' && j.Data && j.Data.Result && j.Data.Result[0]
      ? j.Data.Result[0].PROD_DES
      : '';
  } catch (e) {
    Logger.log(`품목명 조회 오류 [${prodCd}]:`, e);
    return '';
  }
}

// 3) 전체 재고 조회 + 제품명 붙이기 (에러 발생 시 C1에 기록 & 카톡+메일 알림)
function importInventoryListFromEcount() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('재고현황') || ss.insertSheet('재고현황');
  // 시트 초기화 (C1 포함)
  sheet.clear();
  const now = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm:ss');
  sheet.getRange('A1').setValue(`업데이트 시간: ${now}`);
  sheet.appendRow(['위치코드', '품목코드', '제품명', '재고수량']);

  // 1) 로그인
  const sessionId = loginToEcountWithOfficialKey();
  if (!sessionId) {
    const msg = '세션 획득 실패';
    sheet.getRange('C1').setValue('에러 : ' + msg);
    sendErrorAlert('재고 조회 에러', msg);
    return;
  }

  const locationCodes = ['00001', '00004'];
  const baseDate = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyyMMdd');

  // 2) 위치별 재고 조회
  locationCodes.forEach(code => {
    try {
      const apiUrl = `https://oapiCB.ecount.com/OAPI/V2/InventoryBalance/GetListInventoryBalanceStatus?SESSION_ID=${sessionId}`;
      const res = UrlFetchApp.fetch(apiUrl, {
        method: 'post',
        contentType: 'application/json',
        payload: JSON.stringify({ PROD_CD: '', WH_CD: code, BASE_DATE: baseDate }),
        muteHttpExceptions: true,
      });
      if (res.getResponseCode() !== 200) {
        throw new Error(`HTTP ${res.getResponseCode()} at ${code}`);
      }
      const data = JSON.parse(res.getContentText());
      if (data.Status === '200' && data.Data && data.Data.Result) {
        data.Data.Result.forEach(item => {
          const name = getProductName(sessionId, item.PROD_CD);
          sheet.appendRow([code, item.PROD_CD, name, item.BAL_QTY]);
        });
        Logger.log(`✅ 위치 ${code} 조회 완료`);
      } else {
        throw new Error(`Invalid data at ${code}`);
      }
    } catch (e) {
      const err = e.message;
      // C1에 에러 기록
      sheet.getRange('C1').setValue('에러 : 위치 ' + code + ': ' + err);
      Logger.log(`❌ 위치 ${code} 에러: ${err}`);
      sendErrorAlert('재고 조회 에러', `위치 ${code}: ${err}`);
    }
  });
}

// 4) 실행 진입점 (import 먼저, 에러 없을 때만 로그 기록)
function runImportInventory() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var invSheet = ss.getSheetByName('재고현황');

  // ← 여기를 추가: C1 초기화
  if (invSheet) {
    invSheet.getRange('C1').clearContent();
  }

  // 1) 재고 조회 실행 (내부에서 sheet.clear() 도 수행)
  importInventoryListFromEcount();

  // 2) 에러 여부 확인
  var errorMsg = invSheet.getRange('C1').getValue();

  // 3) 에러가 없을 때만 대시보드에 실행로그 기록
  if (!errorMsg) {
    logRegularTriggerMapped('runImportInventory');
  }
}
