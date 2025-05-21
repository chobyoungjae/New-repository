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
  DOC_RANGE:'A1:K20'
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

  /* B) 다음 단계 & 보드 전송 */
  if (role === 'leader') {
    // 1) 팀장 이름 꺼내서 서명 삽입
    const leaderName = data().getRange(row, CFG.COL.LEADER)
                             .getDisplayValue().trim();
    insertSig(row, CFG.COL.LEADER_SIG, leaderName);

    // 2) 검토자 이름 수식
    data().getRange(row, CFG.COL.REVIEWER)
          .setFormula(`=IFERROR(VLOOKUP(L${row}, '${CFG.LOOKUP}'!N:O, 2, FALSE),"")`);
    SpreadsheetApp.flush();

    // 3) 검토자 보드 전송
    const reviewer = data().getRange(row, CFG.COL.REVIEWER)
                           .getDisplayValue().trim();
    if (reviewer) pushToBoard('reviewer', row);

  } else if (role === 'reviewer') {
    // 1) 검토자 이름 꺼내서 서명 삽입
    const reviewerName = data().getRange(row, CFG.COL.REVIEWER)
                                .getDisplayValue().trim();
    insertSig(row, CFG.COL.REVIEWER_SIG, reviewerName);

    // 2) 대표자 이름 수식
    data().getRange(row, CFG.COL.CEO)
          .setFormula(`=IFERROR(VLOOKUP(L${row}, '${CFG.LOOKUP}'!N:P, 3, FALSE),"")`);
    SpreadsheetApp.flush();

    // 3) 대표 보드 전송
    const ceo = data().getRange(row, CFG.COL.CEO)
                      .getDisplayValue().trim();
    if (ceo) pushToBoard('ceo', row);

  } else if (role === 'ceo') {
    // 1) 대표자 이름 꺼내서 서명 삽입
    const ceoName = data().getRange(row, CFG.COL.CEO)
                           .getDisplayValue().trim();
    insertSig(row, CFG.COL.CEO_SIG, ceoName);

    // 2) PDF 생성 & 담당자 보드 전송
    exportPdfAndNotify(row);
    pushToBoard('manager', row);
  }

  return out('서명 완료');
}



function out(msg){ return HtmlService.createHtmlOutput(msg); }

/******** 4. LOOKUP 서명 수식 ********/
function insertSig(row, col, name) {
  const f = `=IFERROR(VLOOKUP("${name}", '${CFG.LOOKUP}'!A:C, 3, FALSE),"서명없음")`;
  data().getRange(row, col).setFormula(f);
  SpreadsheetApp.flush();
}

/******** 5. PDF 생성 & 담당자 대시보드로 전달 ********/
function exportPdfAndNotify(r){
  const lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    const owner = data().getRange(r,2).getValue();
    const sheet = ss.getSheetByName(owner) || tpl();
    const ts    = data().getRange(r,1).getValue();
    const fmt   = Utilities.formatDate(new Date(ts),
                   Session.getScriptTimeZone(),
                   'yyyy-MM-dd_HH:mm:ss');
    const url   = ss.getUrl().replace(/edit$/,'')+
      `export?format=pdf&gid=${sheet.getSheetId()}`+
      `&size=A4&portrait=true&scale=5&gridlines=false`;
    const blob = UrlFetchApp.fetch(url,{
                   headers:{Authorization:'Bearer '+ScriptApp.getOAuthToken()}
                 }).getBlob()
                 .setName(`휴가신청서_${fmt}_${owner}.pdf`);
    const file = DriveApp.getFolderById(CFG.PDF_FOLDER).createFile(blob);

    // manager 보드로 PDF URL 넘기기
    const pdfUrl = file.getUrl();
    pushToBoard('manager', r, pdfUrl);

  } finally {
    lock.releaseLock();
  }
}

/**
 * @param {string} role       'leader'|'reviewer'|'ceo'|'manager'
 * @param {number} srcRow     중앙 시트의 원본 행 번호
 * @param {string} [fileUrl]  PDF 링크 (manager 전용)
 */
function pushToBoard(role, srcRow, fileUrl) {
  const masterId = ss.getId();
  const board    = SpreadsheetApp.openById(CFG.BOARD_ID[role]);
  const sh       = board.getSheets()[0];
  const dstRow   = sh.getLastRow() + 1;

  // A~F: 문서이름, 이름, 연차/반차, 시작일, 종료일, 사유
  const docName = '휴가신청서';
  const name    = data().getRange(srcRow, 2).getValue();
  const type    = data().getRange(srcRow, 3).getValue();
  const start   = data().getRange(srcRow, 7).getValue();
  const end     = data().getRange(srcRow, 8).getValue();
  const reason  = data().getRange(srcRow,10).getValue();
  sh.getRange(dstRow, 1, 1, 6)
    .setValues([[docName, name, type, start, end, reason]]);

  // K열(11): 원본 행 번호 기록
  sh.getRange(dstRow, 11).setValue(srcRow);

  if (role !== 'manager') {
    // H~J: 팀장·검토·대표 서명 수식
    const imp = colLetter =>
      `=IFERROR(IMPORTRANGE("${masterId}", "A시트!${colLetter}${srcRow}"),"")`;
    sh.getRange(dstRow, 8).setFormula(imp('M'));
    sh.getRange(dstRow, 9).setFormula(imp('O'));
    sh.getRange(dstRow,10).setFormula(imp('Q'));

    // L열(12): 체크박스
    sh.getRange(dstRow,12).insertCheckboxes();

  } else {
    // manager 보드: H열에 PDF 링크, J열(10) 체크박스
    sh.getRange(dstRow, 8).setValue(fileUrl);
    sh.getRange(dstRow,10).insertCheckboxes();
  }
}
