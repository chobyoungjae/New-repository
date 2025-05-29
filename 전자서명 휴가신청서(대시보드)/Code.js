/**************** CONFIG ****************/
const CFG = {
  DATA:       'A시트',          // 메인 데이터 시트
  TEMPLATE:   '문서',           // 개인 템플릿 시트
  LOOKUP:     'B시트',          // 이름→대시보드ID 매핑 시트
  MAP_ID:     '문서ID',          // 스프레드시트ID→스크립트ID→URL 매핑 시트
  COL: {
    KEY:         5,
    LEADER:     12,
    LEADER_SIG: 13,
    REVIEWER:   14,
    REVIEWER_SIG:15,
    CEO:        16,
    CEO_SIG:    17
  },
  BOARD_ID: {
    manager: '1bZD1_-sf-DqFDlxdc_PHxMD2hiqpglP_nP1zZkg54M4'
  },
  PDF_FOLDER: '1D1d9F6ArRAnSc1IJDw-qM32hZ6gR-Aa7'
};

const ss   = SpreadsheetApp.getActive();
const data = () => ss.getSheetByName(CFG.DATA);
const tpl  = () => ss.getSheetByName(CFG.TEMPLATE);

/******** 1. 양식 제출 시 – 팀장 보드로 ********/
function onFormSubmit(e) {
  const row      = e.range.getRow();
  let sheetUrl = '';

  // per-person 시트 생성 및 타임스탬프
  const owner = data().getRange(row,2).getValue().toString().trim();
  if (owner) {
    const old = ss.getSheetByName(owner);
    if(old) ss.deleteSheet(old);
    const s = tpl().copyTo(ss).setName(owner);
    s.getRange('F5').setValue(data().getRange(row,1).getValue());
    sheetUrl = ss.getUrl().replace(/\/edit.*$/,'') + `/edit?gid=${s.getSheetId()}`;
  }

  // 팀장명 셋업
  data().getRange(row, CFG.COL.LEADER)
    .setFormula(`=IFERROR(VLOOKUP(B${row}, '${CFG.LOOKUP}'!B:H, 5, FALSE),"")`);
  SpreadsheetApp.flush();

  // 보드로 전송
  const leader = data().getRange(row, CFG.COL.LEADER).getDisplayValue().trim();
  if (leader) {
    const info = lookupBoardByName(leader);
    if (info) pushToBoard(info.boardId, 'leader', row, sheetUrl);
    else Logger.log('⚠ 매핑된 팀장 보드가 없습니다: ' + leader);
  }
}

/******** 2. 역할별 흐름 – Web App 호출 ********/
function doGet(e) {
  const role = e.parameter.role;
  const row  = parseInt(e.parameter.row, 10);
  if (!role || !row) return out('param err');

  const sheetUrl = getPersonalSheetUrl(row);
  console.log(`doGet 호출 → role=${role}, row=${row}`);

  const flow = [
    { role: 'leader',   nameCol: CFG.COL.LEADER,   sigCol: CFG.COL.LEADER_SIG,   lookupCol: CFG.COL.REVIEWER, lookupIdx: 6, nextRole: 'reviewer' },
    { role: 'reviewer', nameCol: CFG.COL.REVIEWER, sigCol: CFG.COL.REVIEWER_SIG, lookupCol: CFG.COL.CEO,      lookupIdx: 7, nextRole: 'ceo' },
    { role: 'ceo',      nameCol: CFG.COL.CEO,      sigCol: CFG.COL.CEO_SIG }
  ];

  const step = flow.find(f => f.role === role);
  if (!step) return out('invalid role');

  // (A) 서명 삽입
  const name = data().getRange(row, step.nameCol).getDisplayValue().trim();
  insertSig(row, step.sigCol, name);
  SpreadsheetApp.flush();

  // (B) 다음 역할이 있으면
  if (step.lookupCol) {
    data().getRange(row, step.lookupCol)
      .setFormula(`=IFERROR(VLOOKUP(L${row}, '${CFG.LOOKUP}'!B:H, ${step.lookupIdx}, FALSE),"")`);
    SpreadsheetApp.flush();

    const nextName = data().getRange(row, step.lookupCol).getDisplayValue().trim();
    if (nextName) {
      const info = lookupBoardByName(nextName);
      if (info) pushToBoard(info.boardId, step.nextRole, row, sheetUrl);
      else Logger.log(`⚠ 매핑된 ${step.nextRole} 보드가 없습니다: ` + nextName);
    }
  }
  // (C) CEO 단계
  else {
    updateHubUrlByVersion();
    updateRowInCalendar(data(), row);
    exportPdfAndNotify(row);
  }

  return out('서명 완료');
}
function out(msg) { return HtmlService.createHtmlOutput(msg); }

/********* 서명 수식 삽입 *********/
function insertSig(row, col, name) {
  const f = `=IFERROR(VLOOKUP("${name}", '${CFG.LOOKUP}'!B:E, 4, FALSE),"서명없음")`;
  data().getRange(row, col).setFormula(f);
  SpreadsheetApp.flush();
}

/********* 이름→보드ID 매핑 *********/
function lookupBoardByName(name) {
  const mapSh = ss.getSheetByName(CFG.MAP_ID);
  const last  = mapSh.getLastRow();
  if (last < 2) return null;
  const vals = mapSh.getRange(2, 2, last - 1, 2).getValues();
  for (let [n, id] of vals) {
    if (n.toString().trim() === name) return { boardId: id.toString().trim() };
  }
  return null;
}

/********* 스크립트ID→URL 매핑 *********/
function lookupExecUrlByScriptId(scriptId) {
  const sh   = ss.getSheetByName(CFG.MAP_ID);
  const last = sh.getLastRow();
  const rows = sh.getRange(2, 4, last - 1, 2).getDisplayValues();
  for (let [id, url] of rows) {
    if (id === scriptId) return url;
  }
  throw new Error(`C시트에서 스크립트ID=${scriptId}를 찾을 수 없습니다.`);
}

/********* 개인 시트 URL 계산 *********/
function getPersonalSheetUrl(row) {
  const owner = data().getRange(row,2).getDisplayValue().trim();
  if (!owner) return '';
  const sh = ss.getSheetByName(owner);
  return sh
    ? ss.getUrl().replace(/\/edit.*$/,'') + `/edit?gid=${sh.getSheetId()}`
    : '';
}

/********* 보드 전송 함수 *********/
function pushToBoard(boardId, role, srcRow, url) {
  const masterId = ss.getId();
  const sh       = SpreadsheetApp.openById(boardId).getSheets()[0];
  const dstRow   = sh.getLastRow() + 1;

  // 1) A~G 값 쓰기
  const ts      = new Date();
  const docName = '전자서명 휴가신청서(대시보드)';
  const vals    = [ts, docName,
                   data().getRange(srcRow,2).getValue(),
                   data().getRange(srcRow,3).getValue(),
                   data().getRange(srcRow,7).getValue(),
                   data().getRange(srcRow,8).getValue(),
                   data().getRange(srcRow,10).getValue()];
  sh.getRange(dstRow,1,1,7).setValues([vals]).setNumberFormat("yyyy/MM/dd HH:mm:ss");

  // 2) 원본 행 번호 및 개인 시트 URL
  sh.getRange(dstRow,11).setValue(srcRow);
  if (url) sh.getRange(dstRow,15).setValue(url);

  // 3) IMPORTRANGE 설정
  const imp = c => `=IFERROR(IMPORTRANGE("${masterId}","A시트!${c}${srcRow}"),"")`;
  sh.getRange(dstRow,8).setFormula(imp('M'));
  sh.getRange(dstRow,9).setFormula(imp('O'));
  sh.getRange(dstRow,10).setFormula(imp('Q'));

  // 4) 체크박스
  sh.getRange(dstRow,12).insertCheckboxes();

  // 5) 서명 하이퍼링크
  const execUrl = lookupExecUrlByScriptId(ScriptApp.getScriptId());
  sh.getRange(dstRow,13)
    .setFormula(`=HYPERLINK("${execUrl}?role=${role}&row=${srcRow}","서명")`);
}

/********* 캘린더 등록 *********/
function updateRowInCalendar(sheet, row) {
  if (sheet.getRange(row,18).getValue() === '등록완료') return;
  if (!sheet.getRange(row,CFG.COL.CEO_SIG).getValue()) return;

  const cal = CalendarApp.getCalendarById('r023hniibcf6hqv2i3897umvn4@group.calendar.google.com');
  if (!cal) { sheet.getRange(row,18).setValue('캘린더 없음'); return; }

  const startDate = sheet.getRange(row,7).getValue();
  const endDate   = sheet.getRange(row,8).getValue();
  if (!(startDate instanceof Date) || !(endDate instanceof Date)) {
    sheet.getRange(row,18).setValue('날짜 오류'); return;
  }

  const title = `${sheet.getRange(row,2).getValue()} ${sheet.getRange(row,6).getValue()} ${sheet.getRange(row,3).getValue()}`;
  const desc  = sheet.getRange(row,10).getValue();
  const team  = sheet.getRange(row,5).getValue();
  const idCell= sheet.getRange(row,19);

  let ev;
  if (startDate.getTime() === endDate.getTime()) {
    ev = cal.createAllDayEvent(title, startDate);
  } else {
    ev = cal.createAllDayEvent(title, startDate, new Date(endDate.getTime()+86400000));
  }
  ev.setDescription(desc).setColor(getColorId(team));
  idCell.setValue(ev.getId());
  sheet.getRange(row,18).setValue('등록완료');
}

function getColorId(team) {
  switch(team) {
    case '생산팀':   return '9';
    case '품질팀':   return '11';
    case '영업팀':   return '10';
    case '마케팅팀': return '5';
    case '물류팀':   return '3';
    default:        return '8';
  }
}

/********* PDF 생성 및 알림 *********/
function exportPdfAndNotify(row) {
  const lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    const owner = data().getRange(row,2).getDisplayValue().trim();
    const sheet = ss.getSheetByName(owner);
    if (!sheet) throw new Error('개인 시트를 찾을 수 없습니다: ' + owner);

    const baseUrl = ss.getUrl().replace(/\/edit$/,'');
    const gid     = sheet.getSheetId();
    const pdfUrl =
     baseUrl + '/export?format=pdf' +
     '&gid='       + gid +
     '&size=A4'    +
     '&portrait=true' +
     '&scale=5'    +   // 기본 확대 배율
     '&spct=1.15'  +   // 실제 인쇄 비율 (115%)
     '&gridlines=false' +
     '&sheetnames=false' +
     '&printtitle=false' +
     '&top_margin=1.2'     +  // 상단 여백 1.2인치
     '&bottom_margin=1.2'  +  // 하단 여백 1.2인치
     '&left_margin=0.7'    +  // 좌우 여백 0.8인치
     '&right_margin=0.7';      // 값은 필요에 따라 조정
    
    const blob    = UrlFetchApp.fetch(pdfUrl, { headers:{ Authorization:'Bearer '+ScriptApp.getOAuthToken() } }).getBlob();

    const ts        = data().getRange(row,1).getValue();
    const formatted = Utilities.formatDate(new Date(ts), Session.getScriptTimeZone(), 'yyyy-MM-dd_HH:mm:ss');
    blob.setName(`휴가신청서_${formatted}_${owner}.pdf`);
    DriveApp.getFolderById(CFG.PDF_FOLDER).createFile(blob);
  } finally {
    lock.releaseLock();
  }
}



function testExportPdf40() {
  exportPdfAndNotify(25);
}