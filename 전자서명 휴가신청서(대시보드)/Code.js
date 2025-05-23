/**************** CONFIG ****************/
const CFG = {
  DATA:'A시트', TEMPLATE:'문서', LOOKUP:'B시트',
  COL : { KEY:5, LEADER:12, LEADER_SIG:13, REVIEWER:14,
          REVIEWER_SIG:15, CEO:16, CEO_SIG:17 },
  BOARD_ID:{                 
    leader:   '1nZjuOUmGv6cAAsF7gwWGNUEKs0xJKPxNyTPeEFU2W2s',
    reviewer: '1DzNCs1Lo5b3jj4qmfuIRsppKTj9tsv_StpSbD8X9Kg8',
    ceo:      '1IhVa24A2pZQCSusioJz8CICv8x_SXpmrtKGsU6-U2i4',
    manager:  '1bZD1_-sf-DqFDlxdc_PHxMD2hiqpglP_nP1zZkg54M4'
  },
  PDF_FOLDER:'1D1d9F6ArRAnSc1IJDw-qM32hZ6gR-Aa7',
  DOC_SHEET: '문서ID',        // exec URL 저장용 시트
  DOC_RANGE: 'A1'
};

const ss   = SpreadsheetApp.getActive();
const data = () => ss.getSheetByName(CFG.DATA);
const tpl  = () => ss.getSheetByName(CFG.TEMPLATE);

/******** 1. 양식 제출 시 – 팀장 이름 넣고 팀장 보드로 ********/
function onFormSubmit(e){
  const row = e.range.getRow();

  /* per-person 시트·타임스탬프 */
  const owner = data().getRange(row,2).getValue().toString().trim();
  if (owner){
    const old = ss.getSheetByName(owner);  if(old) ss.deleteSheet(old);
    const s   = tpl().copyTo(ss).setName(owner);
    s.getRange('F5').setValue(data().getRange(row,1).getValue());
  }

  /* L열 팀장 이름 수식 */
  data().getRange(row, CFG.COL.LEADER)
       .setFormula(`=IFERROR(VLOOKUP(E${row}, '${CFG.LOOKUP}'!M:N, 2, FALSE),"")`);
  SpreadsheetApp.flush();

  /* 팀장 보드로 행 전송 */
  const leader = data().getRange(row, CFG.COL.LEADER).getDisplayValue().trim();
  if (leader) pushToBoard('leader', row);
}

/******** 2. 역할별 흐름 – 대시보드에서 호출 ********/
function doGet(e) {
  const role = e.parameter.role;
  const row  = parseInt(e.parameter.row, 10);
  if (!role || !row) return out('param err');

  console.log('doGet 호출 → role=' + role + ', row=' + row);

  if (role === 'leader') {
    const leaderName = data().getRange(row, CFG.COL.LEADER).getDisplayValue().trim();
    insertSig(row, CFG.COL.LEADER_SIG, leaderName);
    data().getRange(row, CFG.COL.REVIEWER)
          .setFormula(`=IFERROR(VLOOKUP(L${row}, '${CFG.LOOKUP}'!N:O, 2, FALSE),"")`);
    SpreadsheetApp.flush();
    const reviewer = data().getRange(row, CFG.COL.REVIEWER).getDisplayValue().trim();
    if (reviewer) pushToBoard('reviewer', row);

  } else if (role === 'reviewer') {
    const reviewerName = data().getRange(row, CFG.COL.REVIEWER).getDisplayValue().trim();
    insertSig(row, CFG.COL.REVIEWER_SIG, reviewerName);
    data().getRange(row, CFG.COL.CEO)
          .setFormula(`=IFERROR(VLOOKUP(L${row}, '${CFG.LOOKUP}'!N:P, 3, FALSE),"")`);
    SpreadsheetApp.flush();
    const ceo = data().getRange(row, CFG.COL.CEO).getDisplayValue().trim();
    if (ceo) pushToBoard('ceo', row);

  } else if (role === 'ceo') {
    console.log('[CEO] insertSig 실행');
    const ceoName = data().getRange(row, CFG.COL.CEO).getDisplayValue().trim();
    insertSig(row, CFG.COL.CEO_SIG, ceoName);
    SpreadsheetApp.flush();


    updateHubUrlByVersion();        // exec URL 업데이트
    updateRowInCalendar(data(), row);
    exportPdfAndNotify(row);
  }

  return out('서명 완료');
}

function out(msg){ return HtmlService.createHtmlOutput(msg); }

/******** 4. LOOKUP 서명 수식 ********/
function insertSig(row, col, name) {
  const f = `=IFERROR(VLOOKUP("${name}", '${CFG.LOOKUP}'!B:E, 4, FALSE),"서명없음")`;
  data().getRange(row, col).setFormula(f);
  SpreadsheetApp.flush();
}

/**
 * row번째 요청자의 개인 시트를 PDF로 저장하고,
 * 생성된 파일 URL을 매니저 대시보드에 전송합니다.
 * (디버깅용 Logger.log 포함)
 */
function exportPdfAndNotify(row) {
  if (typeof row !== 'number' || row <= 0) {
    throw new Error('exportPdfAndNotify: 유효한 행 번호가 필요합니다. 현재=' + row);
  }

  // 0) 중복 방지용 락 획득
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    // 1) per-person 시트(개인 시트) 가져오기
    const owner = data().getRange(row, 2).getDisplayValue().trim();
    Logger.log('▶ owner(개인 시트 이름): ' + owner);
    const sheet = ss.getSheetByName(owner);
    if (!sheet) throw new Error('개인 시트를 찾을 수 없습니다: ' + owner);

    // 2) PDF export URL 구성
    const baseUrl = ss.getUrl().replace(/\/edit$/, '');
    const gid     = sheet.getSheetId();
    const pdfUrl  = `${baseUrl}/export?format=pdf&gid=${gid}&size=A4&portrait=true`;
    Logger.log('▶ PDF URL: ' + pdfUrl);

    // 3) PDF Blob 생성
    const blob = UrlFetchApp.fetch(pdfUrl, {
      headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }
    }).getBlob();
    Logger.log('▶ Blob 생성 성공, 크기(bytes): ' + blob.getBytes().length);

    // 4) 파일명에 타임스탬프 포함
    const ts        = data().getRange(row, 1).getValue();
    const formatted = Utilities.formatDate(new Date(ts),
                       Session.getScriptTimeZone(),
                       'yyyy-MM-dd_HH-mm-ss');
    const fileName  = `휴가신청서_${formatted}_${owner}.pdf`;
    blob.setName(fileName);
    Logger.log('▶ Blob 이름 설정: ' + fileName);

    // 5) Drive에 파일 저장
    const folder = DriveApp.getFolderById(CFG.PDF_FOLDER);
    Logger.log('▶ 저장할 폴더 ID: ' + folder.getId());
    const file   = folder.createFile(blob);
    Logger.log('▶ 파일 저장 완료, 파일 ID: ' + file.getId());

    // 6) 매니저 대시보드에 전송
    pushToBoard('manager', row, file.getUrl());
    Logger.log('▶ pushToBoard 완료');

  } catch (err) {
    Logger.log('✖ exportPdfAndNotify 에러: ' + err);
    throw err;
  } finally {
    lock.releaseLock();
  }
}








// ========== findUser ========== (B시트에서 이름→이메일/서명 찾기)
function findUser(name) {
  const list = ss.getSheetByName(CONFIG.LOOKUP)
                 .getRange(1, 1,
                   ss.getSheetByName(CONFIG.LOOKUP).getLastRow(),
                   3
                 )
                 .getValues();
  const key = name.toString().trim().toLowerCase();
  const row = list.find(
    r => (r[0]||'').toString().trim().toLowerCase() === key
  );
  if (!row) throw `사용자 정보 없음: ${name}`;
  return {
    email: (row[1]||'').toString().split(/[;,]/)[0].trim(),
    sig: row[2]
  };
}

// ========== getDocHtml ========== (신청서 시트(A1:K20)를 HTML 표로 변환 메일 미리보기)
function getDocHtml(sheet) {
  const s = sheet || tplS();
  const vals = s.getRange(CONFIG.DOC_RANGE).getDisplayValues();
  let html = '<table border="1" cellpadding="4" cellspacing="0" ' +
             'style="border-collapse:collapse;font-size:12px">';
  vals.forEach(r => html += '<tr>' + r.map(c => `<td>${c||''}</td>`).join('') + '</tr>');
  html += '</table>';
  return html;
}


/******** 7. 보드 전송 함수 ********/
function pushToBoard(role, srcRow, fileUrl) {
  const masterId = ss.getId();
  const board    = SpreadsheetApp.openById(CFG.BOARD_ID[role]);
  const sh       = board.getSheets()[0];
  const dstRow   = sh.getLastRow() + 1;

  // A~F: 시간, 문서명, 이름, 연차유형, 시작, 종료, 사유
  const ts     = data().getRange(srcRow, 1).getValue();
  const docName= '전자서명 휴가신청서(대시보드)';
  const name   = data().getRange(srcRow, 2).getValue();
  const type   = data().getRange(srcRow, 3).getValue();
  const start  = data().getRange(srcRow, 7).getValue();
  const end    = data().getRange(srcRow, 8).getValue();
  const reason = data().getRange(srcRow,10).getValue();
  sh.getRange(dstRow, 1, 1, 7)
    .setValues([[ts, docName, name, type, start, end, reason]]);

  // K열(11): 원본 행 번호
  sh.getRange(dstRow, 11).setValue(srcRow);

  if (role !== 'manager') {
    const imp = colLetter =>
      `=IFERROR(IMPORTRANGE("${masterId}", "A시트!${colLetter}${srcRow}"),"")`;
    sh.getRange(dstRow, 8).setFormula(imp('M'));
    sh.getRange(dstRow, 9).setFormula(imp('O'));
    sh.getRange(dstRow,10).setFormula(imp('Q'));
    sh.getRange(dstRow, 12).insertCheckboxes();
  } else {
    sh.getRange(dstRow, 8).setValue(fileUrl);
    sh.getRange(dstRow,10).insertCheckboxes();
  }
}

/******** 8. 캘린더 등록 함수 ********/
function updateRowInCalendar(sheet, row) {
  // 이미 등록됐으면 종료
  if (sheet.getRange(row, 18).getValue() === '등록완료') return;
  // 서명 없으면 종료
  if (!sheet.getRange(row, CFG.COL.CEO_SIG).getValue()) return;

  const cal = CalendarApp.getCalendarById(
    'r023hniibcf6hqv2i3897umvn4@group.calendar.google.com'
  );
  if (!cal) { sheet.getRange(row,18).setValue('캘린더 없음'); return; }

  const startDate   = sheet.getRange(row, 7).getValue();
  const endDate     = sheet.getRange(row, 8).getValue();
  const title       = `${sheet.getRange(row,2).getValue()} ${sheet.getRange(row,6).getValue()} ${sheet.getRange(row,3).getValue()}`;
  const desc        = sheet.getRange(row,10).getValue();
  const team        = sheet.getRange(row, 5).getValue();

  if (!(startDate instanceof Date)) { sheet.getRange(row,18).setValue('시작일 오류'); return; }
  if (!(endDate   instanceof Date)) { sheet.getRange(row,18).setValue('종료일 오류'); return; }

  const idCell = sheet.getRange(row,19);
  let eventId = idCell.getValue();
  if (eventId) {
    try {
      if (eventId.indexOf('@') === -1) eventId += '@google.com';
      if (cal.getEventById(eventId)) return;
    } catch(_){}
  }

  try {
    const colorId = getColorId(team);
    const ev = (startDate.getTime() === endDate.getTime())
      ? cal.createAllDayEvent(title, startDate)
      : cal.createAllDayEvent(title, startDate, new Date(endDate.getTime()+86400000));
    ev.setDescription(desc).setColor(colorId);
    idCell.setValue(ev.getId());
    sheet.getRange(row,18).setValue('등록완료');
  } catch (err) {
    sheet.getRange(row,18).setValue('오류: ' + err.message);
  }
}

function getColorId(team) {
  switch (team) {
    case '생산팀':   return '9';
    case '품질팀':   return '11';
    case '영업팀':   return '10';
    case '마케팅팀': return '5';
    case '물류팀':   return '3';
    default:        return '8';
  }
}

function __grantScopes() { return true; }


/**
 * exportPdfAndNotify 함수를 단독 실행해 볼 수 있는 테스트 함수
 */
function testExportPdf() {
  const testRow = 2;  // PDF 생성을 테스트할 A시트의 행 번호로 변경하세요
  exportPdfAndNotify(testRow);
}

