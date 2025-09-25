/**
 * 강정호 전용 카카오톡 알림 시스템
 * 새로운 행이 추가될 때 자동으로 카카오톡 메시지 발송
 * 작성일: 2025-09-25
 */

/**
 * 변경 시 트리거용 함수 (onChange)
 * 새로운 행이 추가될 때 강정호에게 카카오톡 알림 발송
 */
function onEditForKakaoNotification(e) {
  try {
    console.log('변경 시 트리거 발동:', e);

    // onChange 트리거의 경우 - OTHER 타입도 새 행 추가일 수 있음
    // INSERT_ROW 또는 OTHER 타입일 때 처리
    if (e && (e.changeType === 'INSERT_ROW' || e.changeType === 'OTHER')) {
      const sheet = SpreadsheetApp.getActiveSheet();
      const lastRow = sheet.getLastRow();

      // 마지막 행의 A~D열 데이터 읽기
      const rowData = sheet.getRange(lastRow, 1, 1, 4).getDisplayValues()[0];
      const 작성시간 = rowData[0] || '정보없음';
      const 문서명 = rowData[1] || '정보없음';
      const 작성자 = rowData[2] || '정보없음';
      const 내용 = rowData[3] || '정보없음';

      // A열에 데이터가 있는 경우에만 알림 발송
      if (작성시간 && 작성시간 !== '정보없음') {
        console.log('새 행 추가 감지, 카카오톡 알림 발송:', 작성시간, 문서명, 작성자, 내용);
        sendKakaoMessageToKangJeongho(작성시간, 문서명, 작성자, 내용);
      }
    } else {
      // 다른 변경이거나 e.range가 있는 경우 (폼 제출 등)
      if (e && e.range) {
        const sheet = e.range.getSheet();
        const row = e.range.getRow();

        // 해당 행의 데이터 읽기 (A~D열)
        const rowData = sheet.getRange(row, 1, 1, 4).getDisplayValues()[0];
        const 작성시간 = rowData[0] || '정보없음';
        const 문서명 = rowData[1] || '정보없음';
        const 작성자 = rowData[2] || '정보없음';
        const 내용 = rowData[3] || '정보없음';

        // A열에 데이터가 있는 경우에만 알림 발송
        if (작성시간 && 작성시간 !== '정보없음') {
          console.log('폼 제출 감지, 카카오톡 알림 발송:', 작성시간, 문서명, 작성자, 내용);
          sendKakaoMessageToKangJeongho(작성시간, 문서명, 작성자, 내용);
        }
      }
    }

  } catch (error) {
    console.log('카카오톡 알림 발송 중 오류:', error.message);
  }
}

/**
 * 조병재 토큰으로 강정호에게 카카오톡 메시지 발송 함수
 */
function sendKakaoMessageToKangJeongho(작성시간, 문서명, 작성자, 내용) {
  try {
    // 카카오 토큰 시스템의 스프레드시트 ID
    const 토큰시트스프레드시트ID = '15RDzwxbuo2X3B95axNaU41rj0ZECxfpu4nySK9sjy60';
    const 토큰시트 = SpreadsheetApp.openById(토큰시트스프레드시트ID).getSheetByName('토큰갱신');
    const 친구시트 = SpreadsheetApp.openById(토큰시트스프레드시트ID).getSheetByName('카카오친구목록');

    // 조병재의 Access Token 찾기 (보내는 사람)
    const 토큰데이터 = 토큰시트.getRange(2, 1, 토큰시트.getLastRow() - 1, 3).getValues();
    let accessToken = '';

    for (let i = 0; i < 토큰데이터.length; i++) {
      if (토큰데이터[i][0] === '조병재') {
        accessToken = 토큰데이터[i][1]; // B열 Access Token
        break;
      }
    }

    if (!accessToken) {
      console.log('조병재의 카카오 토큰을 찾을 수 없습니다.');
      return;
    }

    // 강정호의 UUID 찾기 (받는 사람)
    const 친구데이터 = 친구시트.getRange(2, 1, 친구시트.getLastRow() - 1, 3).getValues();
    let 강정호UUID = '';

    for (let i = 0; i < 친구데이터.length; i++) {
      if (친구데이터[i][0] === '강정호') {
        강정호UUID = 친구데이터[i][1]; // B열 UUID
        break;
      }
    }

    if (!강정호UUID) {
      console.log('강정호의 UUID를 찾을 수 없습니다.');
      return;
    }

    // 서명 알람 메시지 내용
    const message = `⏰ 서명 알람\n문서명: ${문서명}\n작성자: ${작성자}\n내   용: ${내용}`;

    // 외부 브라우저로 열기 위한 URL 설정
    const baseUrl = 'https://kakao-test-ebon.vercel.app/go.html?doc=미쓰리서명앱';
    const encodedUrl = encodeURIComponent(baseUrl);

    // 친구에게 보내기 API 페이로드 - iOS/안드로이드 모두 지원
    const payload = {
      receiver_uuids: JSON.stringify([강정호UUID]),
      template_object: JSON.stringify({
        object_type: 'text',
        text: message,
        link: {
          web_url: baseUrl,
          // 모바일에서 외부 브라우저 열기를 위한 설정
          mobile_web_url: baseUrl + '&mobile=1',
        },
        button_title: '서명앱 열기',
      }),
    };

    // 카카오톡 친구에게 보내기 API 호출
    const response = UrlFetchApp.fetch('https://kapi.kakao.com/v1/api/talk/friends/message/default/send', {
      method: 'POST',
      contentType: 'application/x-www-form-urlencoded',
      headers: {
        'Authorization': 'Bearer ' + accessToken
      },
      payload: payload,
      muteHttpExceptions: true
    });

    const responseData = JSON.parse(response.getContentText());

    if (response.getResponseCode() === 200) {
      console.log('✅ 조병재 → 강정호 카카오톡 메시지 발송 성공');
    } else {
      console.log('⚠️ 카카오톡 메시지 발송 실패:', response.getResponseCode());
      console.log('응답 내용:', responseData);
    }

  } catch (error) {
    console.log('❌ 카카오톡 메시지 발송 중 오류:', error.message);
  }
}


/**
 * 수동 테스트용 함수
 * 테스트 데이터로 카카오톡 메시지 발송
 */
function testKakaoMessage() {
  const 테스트데이터 = {
    작성시간: '2025-09-25 14:30:00',
    문서명: '테스트 문서',
    작성자: '테스트 사용자',
    내용: '테스트용 알림 메시지입니다.'
  };

  sendKakaoMessageToKangJeongho(
    테스트데이터.작성시간,
    테스트데이터.문서명,
    테스트데이터.작성자,
    테스트데이터.내용
  );
}