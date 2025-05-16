/**
 * 연차/휴가 신청서 전자서명 & 메일 자동화 스크립트 (v8.4 – formatted)
 * -----------------------------------------------------------------------------
 * • PDF: 템플릿 시트 A1:I30 → 값만 복사(contentsOnly:true) 해서 빈 PDF 문제 해결
 * • scale=4 로 A4 세로 한 페이지 가득 채워 저장
 * • 중복 파일 있으면 기존 파일은 휴지통으로 이동 후 새 파일 1개만 유지
 */

// ========== CONFIG ==========
const CONFIG = {
  DATA: 'A시트',                // 설문 응답 시트
  TEMPLATE: '문서',             // 출력(신청서) 시트
  LOOKUP: 'B시트',              // A:이름 B:메일 C:서명 URL

  COL_REVIEWER: 14,             // N열 ‒ 검토자 이름 입력
  COL_REVIEWER_SIG: 15,         // O열 ‒ 검토자 서명
  COL_CEO_SIG: 17,              // Q열 ‒ 대표 서명

  CELL_CEO_NAME: 'R2',          // 대표자 이름(고정)
  CELL_MANAGER:  'Q2',          // 담당자 이름(고정)

  PDF_FOLDER_ID: '1QxawQmqFzXe_R6GoW9jZyAtjhrmpZV-f',
  WEBAPP_URL:    'https://script.google.com/macros/s/AKfycbwPKuCKVISR-dD0AkNz2aEHDme8PCqOpvF1lwU6Fv0R65_mYab8u117QgaHLA7qpaJ6/exec',

  DOC_RANGE: 'A1:K20',          // 미리보기 범위
  DEBUG: true
};

// ========== HELPERS ==========
const ss    = SpreadsheetApp.getActive();
const dataS = () => ss.getSheetByName(CONFIG.DATA);
const tplS  = () => ss.getSheetByName(CONFIG.TEMPLATE);

// ========== onEdit (검토자 이름 입력) ==========
function onEdit(e) {
  const sh = e.range.getSheet();
  if (sh.getName() !== CONFIG.DATA) return;
  if (e.range.getColumn() !== CONFIG.COL_REVIEWER) return;

  const reviewer = (e.value || '').trim();
  if (!reviewer) return;

  sendMail('reviewer', reviewer, e.range.getRow());
}

// ========== sendMail ==========
function sendMail(role, name, row) {
  const user   = findUser(name);
  const base   = (CONFIG.WEBAPP_URL && !CONFIG.WEBAPP_URL.startsWith('PUT_'))
               ? CONFIG.WEBAPP_URL
               : ScriptApp.getService().getUrl();
  const link   = `${base}?role=${role}&name=${encodeURIComponent(name)}&row=${row}`;
  const subject= `연차/휴가 신청서 ${role === 'reviewer' ? '검토' : '승인'} 요청`;
  const html   = `
    ${name}님,<br><br>
    연차/휴가 신청서 ${role === 'reviewer' ? '검토' : '승인'} 요청입니다.<br>
    <a href="${link}">[확인 및 전자서명]</a><br><br>
    <hr><b>문서 미리보기</b><br>${getDocHtml()}`;

  GmailApp.sendEmail(user.email, subject, '', { htmlBody: html });
  if (CONFIG.DEBUG) Logger.log(`메일 → ${user.email} (${role}, row ${row})`);
}

// ========== 웹앱 엔드포인트 ==========
function doGet(e) {
  const { role, name, row } = e.parameter;
  if (!role || !name || !row) {
    return HtmlService.createHtmlOutput('파라미터 오류');
  }

  const r = parseInt(row, 10);

  if (role === 'reviewer') {
    insertSig(r, CONFIG.COL_REVIEWER_SIG, name);

    const ceoName = dataS().getRange(CONFIG.CELL_CEO_NAME).getValue();
    sendMail('ceo', ceoName, r);

  } else if (role === 'ceo') {
    insertSig(r, CONFIG.COL_CEO_SIG, name);

    // 타임스탬프(A열) → 문서 F5
    const ts = dataS().getRange(r, 1).getValue();
    tplS().getRange('F5').setValue(ts);

    exportPdfAndNotify(r);
  }

  return HtmlService.createHtmlOutput('서명이 완료되었습니다. 창을 닫으셔도 됩니다.');
}

// ========== 서명 삽입 ==========
function insertSig(row, col, name) {
  const formula = `=IFERROR(VLOOKUP("${name}",${CONFIG.LOOKUP}!A:C,3,FALSE),"서명없음")`;
  dataS().getRange(row, col).setFormula(formula);
  SpreadsheetApp.flush();
}

// ========== PDF 생성 & 담당자 알림 ==========
function exportPdfAndNotify(row) {
  /** 기존 임시 시트가 남아있으면 먼저 삭제 */
  const old = ss.getSheetByName(`_print_${row}`);
  if (old) ss.deleteSheet(old);

  /** 1) 템플릿 시트 통째로 복제 */
  const tmp = tplS().copyTo(ss).setName(`_print_${row}`);

  /** 2) PDF 내보내기 URL (A4 · 세로 · 꽉 채우기) */
  const gid  = tmp.getSheetId();
  const url  = ss.getUrl().replace(/edit$/, '') +
    `export?format=pdf&gid=${gid}` +
    '&size=A4&portrait=true' +
    '&scale=5&spct=1.15' +                        // Custom 115% 스케일
    '&gridlines=false&sheetnames=false&pagenumbers=false&printtitle=false';

  const blob = UrlFetchApp.fetch(url, {
    headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }
  }).getBlob();

  /** 3) 파일명 예: 휴가신청서_2025-05-16_김철수_row9.pdf */
  const f5 = tplS().getRange('F5').getDisplayValue();
  const c6 = tplS().getRange('C6').getDisplayValue();
  const fileName = `휴가신청서_${f5}_${c6}_row${row}.pdf`;
  blob.setName(fileName);

  /** 4) 기존 동명 파일 휴지통 → 새 파일 1개만 유지 */
  const folder = DriveApp.getFolderById(CONFIG.PDF_FOLDER_ID);ㅂ
  const dup = folder.getFilesByName(fileName);
  while (dup.hasNext()) dup.next().setTrashed(true);
  const file = folder.createFile(blob);

  /** 5) 담당자에게 메일 */
  const mgr = findUser(dataS().getRange(CONFIG.CELL_MANAGER).getValue());
  GmailApp.sendEmail(
    mgr.email,
    '[완료] 연차/휴가 신청서',
    '서명이 완료되어 PDF를 전달드립니다.\n' + file.getUrl()
  );

  /** 6) 임시 시트 삭제 */
  ss.deleteSheet(tmp);
}


// ========== UTIL ==========
function findUser(name) {
  const list = ss.getSheetByName(CONFIG.LOOKUP)
                 .getRange(1, 1, ss.getSheetByName(CONFIG.LOOKUP).getLastRow(), 3)
                 .getValues();
  const key  = name.toString().trim().toLowerCase();
  const row  = list.find(r => (r[0] || '').toString().trim().toLowerCase() === key);
  if (!row) throw `사용자 정보 없음: ${name}`;

  return {
    email: (row[1] || '').toString().split(/[;,]/)[0].trim(),
    sig:   row[2]
  };
}

function getDocHtml() {
  const vals = tplS().getRange(CONFIG.DOC_RANGE).getDisplayValues();
  let html = '<table border="1" cellpadding="4" cellspacing="0" ' +
             'style="border-collapse:collapse;font-size:12px">';
  vals.forEach(r => {
    html += '<tr>' + r.map(c => `<td>${c || ''}</td>`).join('') + '</tr>';
  });
  return html + '</table>';
}

// ========== 트리거 생성 ==========
function createInstallTrigger() {
  ScriptApp.newTrigger('onEdit')
           .forSpreadsheet(ss)
           .onEdit()
           .create();
  SpreadsheetApp.getUi().alert('onEdit 트리거가 생성되었습니다');
}


// ========== 테스트 (행 번호만 바꿔 실행) ==========
/**
 * exportPdfAndNotify() 를 단독으로 실행해 PDF 생성·담당자 알림만 테스트합니다.
 * row 값(아래 기본 13)을 원하는 행 번호로 바꿔서 실행하세요.
 */
function testExportRow() {
  const row = 11;       // ← 테스트할 행 번호
  exportPdfAndNotify(row);
}

