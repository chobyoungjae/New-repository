/**************** CONFIG ****************/
const CFG = {
  DATA:  'A시트', TEMPLATE: '문서', LOOKUP: 'B시트',
  COL : { SIG_AUTHOR:28, LEADER:29, LEADER_SIG: 30},
  BOARD_ID: {
    leader:  '1ROg7B9t_4rbu42U6ewKRxlkPOycJU47i4mhNqUYTelw', // DB_강정호 팀장
    manager: '1iH1iU0_x5J7Jbkanb5wBP6sjL1HAXAzvhxx3LVZEqIE'  // DB_오수진 담당
  },
  PDF_FOLDER: '1eWZ4orSdPSQuiSkrURkuNbUCVJfnR4eM',
  DOC_SHEET : '문서ID',        // exec URL 저장용 시트
  DOC_RANGE : 'A1'
};

/********** Helpers **********/
const ss   = SpreadsheetApp.getActive();
const data = () => ss.getSheetByName(CFG.DATA);
const tpl  = () => ss.getSheetByName(CFG.TEMPLATE);

/********** 1) 폼 제출 시 → 웹앱 호출 **********/
function onFormSubmit(e){
  const sh = data();                // ← 여기에!
  const row = e.range.getRow();
  let sheetUrl = '';  // ← 추가: 개인 시트 URL 담을 변수

  /* per-person 시트·타임스탬프 */
  const owner = data().getRange(row,2).getValue().toString().trim();
  if (owner){
    const old = ss.getSheetByName(owner);  if(old) ss.deleteSheet(old);
    const s   = tpl().copyTo(ss).setName(owner);
    s.getRange('b3').setValue(data().getRange(row,1).getValue());
    
    // ← 추가: 개인 시트 URL 생성
    sheetUrl = ss.getUrl().replace(/\/edit.*$/,'') + `/edit?gid=${s.getSheetId()}`;
  }

  /* ② 작성자 서명 - ③ 팀장 이름 수식 */
  sh.getRange(row, CFG.COL.SIG_AUTHOR)
    .setFormula(`=IFERROR(VLOOKUP($B${row}, '${CFG.LOOKUP}'!B:E, 4, FALSE),"")`);
  sh.getRange(row, CFG.COL.LEADER)
    .setFormula(`=IFERROR(VLOOKUP($B${row}, '${CFG.LOOKUP}'!B:F, 5, FALSE),"")`);
  SpreadsheetApp.flush();

  /* 팀장 보드로 행 전송 */
  const leader = data().getRange(row, CFG.COL.LEADER).getDisplayValue().trim();
  if (leader) pushToBoard('leader', row, sheetUrl);
}



/********** 2) 웹앱 진입점 – doGet **********/
function doGet(e) {
  const role = e.parameter.role;
  const row  = parseInt(e.parameter.row, 10);
  if (!role || !row) return out('param err');

  console.log('doGet 호출 → role=' + role + ', row=' + row);

  if (role === 'leader') {
    const leaderName = data().getRange(row, CFG.COL.LEADER).getDisplayValue().trim();
    insertSig(row, CFG.COL.LEADER_SIG, leaderName);
    SpreadsheetApp.flush();

    exportPdfAndNotify(row);

  }

}

/******** 4. LOOKUP 서명 수식 ********/
function insertSig(row, col, name) {
  const f = `=IFERROR(VLOOKUP("${name}", '${CFG.LOOKUP}'!B:E, 4, FALSE),"서명없음")`;
  data().getRange(row, col).setFormula(f);
  SpreadsheetApp.flush();
}


/******** 7. 보드 전송 함수 ********/
function pushToBoard(role, srcRow, url) {
  const masterId = ss.getId();
  const board    = SpreadsheetApp.openById(CFG.BOARD_ID[role]);
  const sh       = board.getSheets()[0];
  const dstRow   = sh.getLastRow() + 1;

  // A~F: 시간, 문서명, 이름, 연차유형, 시작, 종료, 사유
  const ts = new Date();
  const docName= '실험실 위생점검표(응답)';
  const name   = data().getRange(srcRow, 2).getValue();
  const type   = data().getRange(srcRow, 3).getValue();
  const start  = data().getRange(srcRow, 7).getValue();
  const end    = data().getRange(srcRow, 8).getValue();
  const reason = data().getRange(srcRow,10).getValue();
  
  // 1) 값 쓰기
  sh.getRange(dstRow, 1, 1, 7)
    .setValues([[ts, docName, name, type, start, end, reason]]);
  
  // 2) A열(타임스탬프)만 날짜+시간 서식 적용
  sh.getRange(dstRow, 1)
    .setNumberFormat("yyyy-MM-dd HH:mm:ss");

  // K열(11): 원본 행 번호
  sh.getRange(dstRow, 11).setValue(srcRow);
  // O열(15): 개인 시트 URL
  if (url) sh.getRange(dstRow, 15).setValue(url);

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
                       'yyyy/MM/dd_HH:mm:ss');
    const fileName  = `실험실 위생점검표(응답)_${formatted}_${owner}.pdf`;
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