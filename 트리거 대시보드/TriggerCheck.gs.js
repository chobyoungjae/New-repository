/**
 * 간결화된 트리거 대시보드 스크립트
 *
 * - getTriggersForSheetList(): '문서목록' → '정기 트리거 상태' 초기화
 * - pollTriggers(): 매분 스캔하여 제때 실행/지연 실행 구분, 지연 시 버튼형 카톡 알림
 * - getKakaoToken(), sendKakaoText(), sendKakaoFeedWithButton(): 카카오톡 메시지 전송
 */

/**
 * 1) UUID 시트의 F1에서 카카오 API 액세스 토큰을 읽어옵니다.
 */
function getKakaoToken() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('UUID');
  return sheet.getRange('F1').getValue();
}

/**
 * 2) 기본 텍스트 메시지 전송 (필요시)
 */
function sendKakaoText(message) {
  const url = 'https://kapi.kakao.com/v2/api/talk/memo/default/send';
  const token = getKakaoToken();
  const payload =
    'template_object=' + encodeURIComponent(JSON.stringify({ object_type: 'text', text: message }));
  UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/x-www-form-urlencoded',
    headers: { Authorization: 'Bearer ' + token },
    payload: payload,
    muteHttpExceptions: true,
  });
}

/**
 * 3) 버튼이 포함된 피드 메시지 전송
 */
function sendKakaoFeedWithButton(title, buttonTitle, buttonUrl) {
  const url = 'https://kapi.kakao.com/v2/api/talk/memo/default/send';
  const token = getKakaoToken();
  const template = {
    object_type: 'feed',
    content: {
      title: title,
      description: '',
      link: { web_url: buttonUrl, mobile_web_url: buttonUrl },
    },
    buttons: [
      {
        title: buttonTitle,
        link: { web_url: buttonUrl, mobile_web_url: buttonUrl },
      },
    ],
  };
  const payload = 'template_object=' + encodeURIComponent(JSON.stringify(template));
  UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/x-www-form-urlencoded',
    headers: { Authorization: 'Bearer ' + token },
    payload: payload,
    muteHttpExceptions: true,
  });
}

/**
 * 4) '문서목록' → '정기 트리거 상태' 초기화
 */
function getTriggersForSheetList() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const listSheet = ss.getSheetByName('문서목록');
  const statusSheet = ss.getSheetByName('정기 트리거 상태') || ss.insertSheet('정기 트리거 상태');

  // 헤더 설정
  statusSheet
    .getRange(1, 1, 1, 6)
    .setValues([['문서 설명', '문서 ID', '스크립트 ID', '예약시간', '상태', '최종 실행시간']]);

  // 기존 E,F 초기화
  const lastRow = statusSheet.getLastRow();
  if (lastRow > 1) {
    statusSheet.getRange(2, 5, lastRow - 1, 2).clearContent();
  }

  // 목록 데이터 복사
  const data = listSheet.getDataRange().getValues();
  const newData = [];
  for (let i = 1; i < data.length; i++) {
    const r = data[i];
    if (r[0] && r[1] && r[2] && r[3]) {
      newData.push([r[0], r[1], r[2], r[3]]);
    }
  }
  if (newData.length) {
    statusSheet.getRange(2, 1, newData.length, 4).setValues(newData);
  }
}

/**
 * 5) 매분 스캔 방식 트리거 실행/지연 판별
 *    - 제때: ✅ 실행됨
 *    - 지연: ❌ 미작동 + 버튼형 카톡 알림
 */
function pollTriggers() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('정기 트리거 상태');
  if (!sheet) return;
  const now = new Date();
  const rows = sheet.getDataRange().getValues();

  for (let i = 1; i < rows.length; i++) {
    if (rows[i][4]) continue; // 이미 처리된 행
    const raw = rows[i][3];
    let h, m;
    if (raw instanceof Date) {
      h = raw.getHours();
      m = raw.getMinutes();
    } else if (typeof raw === 'string' && raw.includes(':')) {
      const parts = raw.split(':');
      h = parseInt(parts[0], 10);
      m = parseInt(parts[1], 10);
    } else {
      continue;
    }

    const scheduled = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m);
    if (scheduled <= now) {
      // F열 기록
      sheet.getRange(i + 1, 6).setValue(now);
      if (scheduled.getHours() === now.getHours() && scheduled.getMinutes() === now.getMinutes()) {
        // 제때 실행
        sheet.getRange(i + 1, 5).setValue('✅ 실행됨');
      } else {
        // 지연 실행
        sheet.getRange(i + 1, 5).setValue('❌ 미작동');
        const sheetName = rows[i][0];
        const fnName = rows[i][2];
        const titleText = `${sheetName}의 ${fnName} 트리거 미작동 알림`;
        const buttonUrl = 'https://kakao-test-ebon.vercel.app/go.html?doc=대시보드';

        // ——— 카카오톡 버튼형 알림 ———
        sendKakaoFeedWithButton(titleText, '내용 확인', buttonUrl);

        // ——— 이메일 알림 ———
        const recipient = 'oosdream3@gmail.com';
        const subject = titleText;
        const body = `내용 확인: ${buttonUrl}`;
        MailApp.sendEmail(recipient, subject, body);
      }
      break;
    }
  }
}
