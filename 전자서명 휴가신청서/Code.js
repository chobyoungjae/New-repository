// ========== CONFIG ==========
const CONFIG = {
  DATA: 'A시트',                // 설문 응답 시트
  TEMPLATE: '문서',             // 출력(신청서) 시트 템플릿
  LOOKUP: 'B시트',              // A:이름 B:메일 C:서명 URL

  COL_KEY: 5,                   // E열 – lookup 키
  COL_LEADER: 12,               // L열 – 팀장명 입력
  COL_LEADER_SIG: 13,           // M열 – 팀장 서명
  COL_REVIEWER: 14,             // N열 – 검토자명 입력
  COL_REVIEWER_SIG: 15,         // O열 – 검토자 서명
  COL_CEO: 16,                  // P열 – 검토자 추가정보 ← 새로 추가
  COL_CEO_SIG: 17,              // Q열 – 대표 서명

  CELL_CEO_NAME: 'R2',          // 대표자 이름(고정)
  CELL_MANAGER: 'Q2',           // 담당자 이름(고정)

  PDF_FOLDER_ID: '1QxawQmqFzXe_R6GoW9jZyAtjhrmpZV-f',
  WEBAPP_URL: 'https://script.google.com/macros/s/AKfycbz1IjjknXKdrZOpLmzzSkXqAc4FzvNnVLjFK9XN28dd5KlC1eWbKOTqawG62dF0QKD3Lw/exec',   // ← 고정 URL
  DOC_RANGE: 'A1:K20',          // 미리보기 범위
  DEBUG: true
};

// ========== HELPERS ==========
const ss = SpreadsheetApp.getActive();
const dataS = () => ss.getSheetByName(CONFIG.DATA);
const tplS = () => ss.getSheetByName(CONFIG.TEMPLATE);


// ========== onFormSubmit ==========
/**
 * 폼 제출 시:
 * 1) per-person 시트 생성 및 F5 타임스탬프 삽입
 * 2) L열에 팀장 lookup 수식 삽입
 * 3) 팀장에게 메일 발송
 */
function onFormSubmit(e) {
  const sheet = dataS();
  if (!sheet || !e.range) return;
  const row = e.range.getRow();

  // 1) per-person 시트 생성
  const owner = sheet.getRange(row, 2).getValue().toString().trim();
  if (owner) {
    const oldSheet = ss.getSheetByName(owner);
    if (oldSheet) ss.deleteSheet(oldSheet);
    const newSheet = tplS().copyTo(ss).setName(owner);
    // 2) F5에 타임스탬프 삽입
    const ts = sheet.getRange(row, 1).getValue();
    newSheet.getRange('F5').setValue(ts);
  }

  // 3) L열: 팀장 lookup 수식 삽입
  sheet.getRange(row, CONFIG.COL_LEADER)
       .setFormula(`=IFERROR(VLOOKUP(E${row}, '${CONFIG.LOOKUP}'!M:N, 2, FALSE), "")`);
  SpreadsheetApp.flush();

  // 4) 팀장에게 메일 발송
  const leader = sheet.getRange(row, CONFIG.COL_LEADER).getDisplayValue().trim();
  if (leader) sendMail('leader', leader, row);
}

// ========== onEdit ==========
/**
 * 시트 직접 편집에 반응:
 * L열 입력 시 팀장 메일 발송
 */
function onEdit(e) {
  const sh = e.range.getSheet();
  if (sh.getName() !== CONFIG.DATA) return;
  const col = e.range.getColumn();
  const row = e.range.getRow();
  const value = (e.value || '').trim();
  if (!value) return;

  // L열: 팀장명 입력
  if (col === CONFIG.COL_LEADER) {
    sendMail('leader', value, row);
  }
}

// ========== sendMail ==========
/**
 * role: 'leader' | 'reviewer' | 'ceo'
 */
function sendMail(role, name, row) {
  const user = findUser(name);
  if (!user.email) throw `이메일 없음: ${name}`;

  // 1) 웹앱 링크
  const base = CONFIG.WEBAPP_URL;    // 하드코딩 URL 사용
  const link = `${base}?role=${role}&name=${encodeURIComponent(name)}&row=${row}`;
  const action = (role === 'ceo') ? '승인' : '검토';
  const subject = `연차/휴가 신청서 ${action} 요청`;

  // 2) per-person 시트 미리보기
  const owner = dataS().getRange(row, 2).getValue().toString().trim();
  const previewSheet = ss.getSheetByName(owner) || tplS();
  const previewHtml = getDocHtml(previewSheet);

  const html = `${name}님,<br><br>` +
               `연차/휴가 신청서 ${action} 요청입니다.<br>` +
               `<a href="${link}">[확인 및 전자서명]</a><br><hr>` +
               previewHtml;

  GmailApp.sendEmail(user.email, subject, '', { htmlBody: html });
  if (CONFIG.DEBUG) Logger.log(`메일 → ${user.email} (${role}, row ${row})`);
}

function doGet(e) {
  const { role, name, row } = e.parameter;
  if (!role || !name || !row)
    return HtmlService.createHtmlOutput('파라미터 오류');

  const r     = parseInt(row, 10);
  const sheet = dataS();

  /* ───────── leader ───────── */
  if (role === 'leader') {
    // ▼ 문 잠그기
    const lock = LockService.getDocumentLock();
    lock.waitLock(3000);          // 최대 3초 대기

    try {
  // 팀장 서명(M열)
  insertSig(r, CONFIG.COL_LEADER_SIG, name);
  SpreadsheetApp.flush();

  // 검토자 이름 수식 (N열)
  sheet.getRange(r, CONFIG.COL_REVIEWER)
       .setFormula(`=IFERROR(VLOOKUP(L${r}, '${CONFIG.LOOKUP}'!N:O, 2, FALSE),"")`);
  SpreadsheetApp.flush();

  const reviewer = sheet.getRange(r, CONFIG.COL_REVIEWER).getDisplayValue().trim();
  if (reviewer) sendMail('reviewer', reviewer, r);   // 검토자 메일만 전송
} finally {
  lock.releaseLock();
}
    return HtmlService.createHtmlOutput('서명이 완료되었습니다.');
  }

/* ───────── reviewer 블록 ───────── */
if (role === 'reviewer') {
  // ▼ 문 잠그기
    const lock = LockService.getDocumentLock();
    lock.waitLock(3000);          // 최대 3초 대기

  insertSig(r, CONFIG.COL_REVIEWER_SIG, name);        // O열 서명
  SpreadsheetApp.flush();

  // P열 수식 삽입 → 상수 사용
  sheet.getRange(r, CONFIG.COL_CEO)           // 16 = P열
       .setFormula(`=IFERROR(VLOOKUP(L${r}, '${CONFIG.LOOKUP}'!N:P, 3, FALSE),"")`);
  SpreadsheetApp.flush();

  const reviewer = sheet.getRange(r, CONFIG.COL_CEO).getDisplayValue().trim();
  if (reviewer) sendMail('ceo', reviewer, r);   // 대표자 메일만 전송
  
  
  return HtmlService.createHtmlOutput('서명이 완료되었습니다.');
}


  /* ───────── ceo ───────── */
  if (role === 'ceo') {
    // ▼ 문 잠그기
    const lock = LockService.getDocumentLock();
    lock.waitLock(3000);

    try {
  insertSig(r, CONFIG.COL_CEO_SIG, name);  // Q열 서명
  SpreadsheetApp.flush();

  exportPdfAndNotify(r);                   // PDF + 담당자 메일
  updateRowInCalendar(dataS(), r);          // ← ➊ 캘린더로 push

} finally {
  lock.releaseLock();
}
    return HtmlService.createHtmlOutput('서명이 완료되었습니다.');
  }

  return HtmlService.createHtmlOutput('서명이 완료되었습니다.');
}



// ========== insertSig ========== (B시트에서 서명 URL 찾아서 넣어줌)
function insertSig(row, col, name) {
  const formula = `=IFERROR(VLOOKUP("${name}",${CONFIG.LOOKUP}!A:C,3,FALSE),"서명없음")`;
  dataS().getRange(row, col).setFormula(formula);
  SpreadsheetApp.flush();
}

// ========== exportPdfAndNotify ==========
// (PDF 만들고 담당자에게 메일 전송)
function exportPdfAndNotify(row) {

  const statusCell = dataS().getRange(row, 18);      // R열

  /* A. 이미 처리된 행이면 종료 */
  if (statusCell.getValue() === '등록완료') return;

  /* B. 배타 락 */
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) return;

  try {
    /* C. 두 번째 인스턴스용 빠른 재검사 */
    if (statusCell.getValue() === '등록완료') return;

    /* D. --- 먼저 '등록완료' 기록 후 즉시 저장 ---------- */
    statusCell.setValue('등록완료');
    SpreadsheetApp.flush();         // ← 여기서 시트에 바로 반영

    /* E. --- 이후 PDF·메일 작업은 그대로 --------------- */
    const owner = dataS().getRange(row, 2).getValue().toString().trim();
    const sheet = ss.getSheetByName(owner) || tplS();

    const url = ss.getUrl().replace(/edit$/, '') +
      `export?format=pdf&gid=${ sheet.getSheetId() }` +
      `&size=A4&portrait=true&scale=5` +
      `&spct=1.15&gridlines=false&sheetnames=false&printtitle=false`;

    const blob = UrlFetchApp.fetch(url, {
      headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }
    }).getBlob();

    const ts   = sheet.getRange('F5').getValue();
    const tz   = Session.getScriptTimeZone();
    const fmt  = Utilities.formatDate(new Date(ts), tz, 'yyyy-MM-dd_HH:mm:ss');
    blob.setName(`휴가신청서_${fmt}_${owner}.pdf`);

    const file = DriveApp.getFolderById(CONFIG.PDF_FOLDER_ID)
                         .createFile(blob);

    const mgrEmail = findUser(
      dataS().getRange(CONFIG.CELL_MANAGER).getValue()
    ).email;

    GmailApp.sendEmail(
      mgrEmail,
      '[완료] 연차/휴가 신청서',
      '서명이 완료되어 PDF 전달드립니다.\n' + file.getUrl()
    );

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


function updateRowInCalendar(sheet, row) {

  /* 추가 ①: 이미 ‘등록완료’면 바로 종료 */
  if (sheet.getRange(row, 18).getValue() === '등록완료') return;

  /* 추가 ②: Q열(대표 서명) 없으면 종료 */
  if (!sheet.getRange(row, CONFIG.COL_CEO_SIG).getValue()) return;
  
  const cal = CalendarApp.getCalendarById(
    'r023hniibcf6hqv2i3897umvn4@group.calendar.google.com'
  );
  if (!cal) { sheet.getRange(row,18).setValue('캘린더 없음'); return; }

  const startDate   = sheet.getRange(row, 7).getValue();   // G
  const endDate     = sheet.getRange(row, 8).getValue();   // H
  const text1       = sheet.getRange(row, 2).getValue();   // B
  const text2       = sheet.getRange(row, 6).getValue();   // F
  const text3       = sheet.getRange(row, 3).getValue();   // C
  const description = sheet.getRange(row,10).getValue();   // J
  const team        = sheet.getRange(row, 5).getValue();   // E

  if (!(startDate instanceof Date)) { sheet.getRange(row,18).setValue('시작일 오류'); return; }
  if (!(endDate   instanceof Date)) { sheet.getRange(row,18).setValue('종료일 오류'); return; }

  let idCell = sheet.getRange(row,19);                     // S
  let eventId = idCell.getValue();
  if (eventId) {
  try {
    if (eventId.indexOf('@') === -1) eventId += '@google.com';
    if (cal.getEventById(eventId)) return;   // ← R열 안 건드리고 끝
  } catch (err) { /* 계속 진행 */ }
}


  try {
    const title   = `${text1} ${text2} ${text3}`;
    const colorId = getColorId(team);
    const endAdj  = new Date(endDate.getTime() + 86400000); // +1일

    const ev = (startDate.getTime() === endDate.getTime())
        ? cal.createAllDayEvent(title, startDate)
        : cal.createAllDayEvent(title, startDate, endAdj);

    ev.setDescription(description);
    ev.setColor(colorId);

    idCell.setValue(ev.getId());            // S
    sheet.getRange(row,18).setValue('등록완료');  // R
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
