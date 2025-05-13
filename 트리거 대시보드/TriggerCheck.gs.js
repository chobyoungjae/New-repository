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
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('UUID');
  return sheet.getRange('F1').getValue();
}

/**
 * 2) 기본 텍스트 메시지 전송 (필요시)
 */
function sendKakaoText(message) {
  var url     = 'https://kapi.kakao.com/v2/api/talk/memo/default/send';
  var token   = getKakaoToken();
  var payload = 'template_object=' + encodeURIComponent(
    JSON.stringify({ object_type:'text', text:message })
  );
  UrlFetchApp.fetch(url, {
    method:'post',
    contentType:'application/x-www-form-urlencoded',
    headers:{ Authorization:'Bearer ' + token },
    payload:payload,
    muteHttpExceptions:true
  });
}

/**
 * 3) 버튼이 포함된 피드 메시지 전송
 */
function sendKakaoFeedWithButton(title, buttonTitle, buttonUrl) {
  var url     = 'https://kapi.kakao.com/v2/api/talk/memo/default/send';
  var token   = getKakaoToken();
  var template = {
    object_type:'feed',
    content:{
      title:       title,
      description: '',
      link: { web_url:buttonUrl, mobile_web_url:buttonUrl }
    },
    buttons:[{ title:buttonTitle, link:{ web_url:buttonUrl, mobile_web_url:buttonUrl } }]
  };
  var payload = 'template_object=' + encodeURIComponent(JSON.stringify(template));
  UrlFetchApp.fetch(url, {
    method:'post',
    contentType:'application/x-www-form-urlencoded',
    headers:{ Authorization:'Bearer ' + token },
    payload:payload,
    muteHttpExceptions:true
  });
}

/**
 * 4) '문서목록' → '정기 트리거 상태' 초기화
 */
function getTriggersForSheetList() {
  var ss          = SpreadsheetApp.getActiveSpreadsheet();
  var listSheet   = ss.getSheetByName('문서목록');
  var statusSheet = ss.getSheetByName('정기 트리거 상태') || ss.insertSheet('정기 트리거 상태');

  // 헤더 설정
  statusSheet.getRange(1,1,1,6).setValues([[
    '문서 설명','문서 ID','스크립트 ID','예약시간','상태','최종 실행시간'
  ]]);

  // 기존 E,F 초기화
  var lastRow = statusSheet.getLastRow();
  if (lastRow > 1) {
    statusSheet.getRange(2,5,lastRow-1,2).clearContent();
  }

  // 목록 데이터 복사
  var data    = listSheet.getDataRange().getValues();
  var newData = [];
  for (var i=1; i<data.length; i++) {
    var r = data[i];
    if (r[0] && r[1] && r[2] && r[3]) {
      newData.push([r[0],r[1],r[2],r[3]]);
    }
  }
  if (newData.length) {
    statusSheet.getRange(2,1,newData.length,4).setValues(newData);
  }
}

/**
 * 5) 매분 스캔 방식 트리거 실행/지연 판별
 *    - 제때: ✅ 실행됨
 *    - 지연: ❌ 미작동 + 버튼형 카톡 알림
 */
function pollTriggers() {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('정기 트리거 상태');
  if (!sheet) return;
  var now  = new Date();
  var rows = sheet.getDataRange().getValues();

  for (var i=1; i<rows.length; i++) {
    if (rows[i][4]) continue;  // 이미 처리된 행
    var raw = rows[i][3], h, m;
    if (raw instanceof Date) {
      h = raw.getHours(); m = raw.getMinutes();
    } else if (typeof raw==='string' && raw.indexOf(':')>-1) {
      var p = raw.split(':'); h=parseInt(p[0],10); m=parseInt(p[1],10);
    } else continue;

    var scheduled = new Date(now.getFullYear(),now.getMonth(),now.getDate(),h,m);
    if (scheduled <= now) {
      // F열 기록
      sheet.getRange(i+1,6).setValue(now);
      if (scheduled.getHours()===now.getHours() && scheduled.getMinutes()===now.getMinutes()) {
        // 제때 실행
        sheet.getRange(i+1,5).setValue('✅ 실행됨');
      } else {
        // 지연 실행
        sheet.getRange(i+1,5).setValue('❌ 미작동');
        var sheetName = rows[i][0];
        var fnName    = rows[i][2];
        var titleText = sheetName + '의 ' + fnName + ' 트리거 미작동 알림';
        var buttonUrl = 'https://kakao-test-ebon.vercel.app/go.html?doc=대시보드';

        // ——— 카카오톡 버튼형 알림 ———
        sendKakaoFeedWithButton(titleText, '내용 확인', buttonUrl);

        // ——— 이메일 알림 ———
        var recipient = 'oosdream3@gmail.com';
        var subject   = titleText;
        var body      = '내용 확인: ' + buttonUrl;
        MailApp.sendEmail(recipient, subject, body);
      }
      break;
    }
  }
}
