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
  COL_CEO_SIG: 17,              // Q열 – 대표 서명

  CELL_CEO_NAME: 'R2',          // 대표자 이름(고정)
  CELL_MANAGER: 'Q2',           // 담당자 이름(고정)

  PDF_FOLDER_ID: '1QxawQmqFzXe_R6GoW9jZyAtjhrmpZV-f',
  WEBAPP_URL: 'https://script.google.com/macros/s/AKfycbxtWg2HpU7hJP7REklonHJ59ge77HH3lSBiMJPuprO9nkMFklsvSDu8LUOy_P7TOOOY/exec',
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
  const base = CONFIG.WEBAPP_URL;
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

// ========== doGet ==========
function doGet(e) {
  const { role, name, row } = e.parameter;
  if (!role || !name || !row) return HtmlService.createHtmlOutput('파라미터 오류');
  const r = parseInt(row, 10);

  if (role === 'leader') {
    insertSig(r, CONFIG.COL_LEADER_SIG, name);
    SpreadsheetApp.flush();
    // N열: 검토자명 수식 삽입 후 메일 발송
    const formula = `=IFERROR(VLOOKUP(L${r}, '${CONFIG.LOOKUP}'!N:O, 2, FALSE), "")`;
    dataS().getRange(r, CONFIG.COL_REVIEWER).setFormula(formula);
    SpreadsheetApp.flush();
    const reviewer = dataS().getRange(r, CONFIG.COL_REVIEWER).getDisplayValue().trim();
    if (reviewer) sendMail('reviewer', reviewer, r);

  } else if (role === 'reviewer') {
    insertSig(r, CONFIG.COL_REVIEWER_SIG, name);
    SpreadsheetApp.flush();
    const ceoName = dataS().getRange(CONFIG.CELL_CEO_NAME).getValue().toString().trim();
    if (ceoName) sendMail('ceo', ceoName, r);

  } else if (role === 'ceo') {
    insertSig(r, CONFIG.COL_CEO_SIG, name);
    SpreadsheetApp.flush();
    exportPdfAndNotify(r);
  }

  return HtmlService.createHtmlOutput('서명이 완료되었습니다.');
}

// ========== insertSig ==========
function insertSig(row, col, name) {
  const formula = `=IFERROR(VLOOKUP("${name}",${CONFIG.LOOKUP}!A:C,3,FALSE),"서명없음")`;
  dataS().getRange(row, col).setFormula(formula);
  SpreadsheetApp.flush();
}

// ========== exportPdfAndNotify ==========
function exportPdfAndNotify(row) {
  const owner = dataS().getRange(row, 2).getValue().toString().trim();
  const sheet = ss.getSheetByName(owner) || tplS();
  const gid = sheet.getSheetId();
  const url = ss.getUrl().replace(/edit$/, '') +
    `export?format=pdf&gid=${gid}` +
    `&size=A4&portrait=true&scale=5` +
    `&spct=1.15&gridlines=false&sheetnames=false&printtitle=false`;
  const blob = UrlFetchApp.fetch(url, {
    headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }
  }).getBlob();

  // 파일명: 휴가신청서_YYYY-MM-DD_이름.pdf
  const ts = sheet.getRange('F5').getValue();
  const formattedDate = Utilities.formatDate(new Date(ts), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  const fileName = `휴가신청서_${formattedDate}_${owner}.pdf`;
  blob.setName(fileName);

  const mgrEmail = findUser(
    dataS().getRange(CONFIG.CELL_MANAGER).getValue()
  ).email;
  GmailApp.sendEmail(
    mgrEmail,
    '[완료] 연차/휴가 신청서',
    '서명이 완료되어 PDF 전달드립니다.\n' + file.getUrl()
  );
}

// ========== findUser ==========
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

// ========== getDocHtml ==========
function getDocHtml(sheet) {
  const s = sheet || tplS();
  const vals = s.getRange(CONFIG.DOC_RANGE).getDisplayValues();
  let html = '<table border="1" cellpadding="4" cellspacing="0" ' +
             'style="border-collapse:collapse;font-size:12px">';
  vals.forEach(r => html += '<tr>' + r.map(c => `<td>${c||''}</td>`).join('') + '</tr>');
  html += '</table>';
  return html;
}

// ========== createInstallTrigger ==========
function createInstallTrigger() {
  ScriptApp.newTrigger('onEdit')
           .forSpreadsheet(ss)
           .onEdit()
           .create();
  ScriptApp.newTrigger('onFormSubmit')
           .forSpreadsheet(ss)
           .onFormSubmit()
           .create();
}
