/**************** CONFIG ****************/ // << 설정 섹션 시작
const CFG = {
  // << 전역 설정 객체 선언
  DATA: 'A시트', // << 메인 데이터 시트 이름
  TEMPLATE: '문서', // << 개인 템플릿 시트 이름
  LOOKUP: 'B시트', // << 이름→대시보드ID 매핑 시트 이름
  MAP_ID: '문서ID', // << 스프레드시트ID→스크립트ID→URL 매핑 시트 이름
  COL: {
    // << 컬럼 인덱스 매핑
    KEY: 5, // << 키(이름) 컬럼 인덱스
    CEO: 14, // << 팀장 컬럼 인덱스
    CEO_SIG: 15, // << 팀장 서명 컬럼 인덱스
  },
  BOARD_ID: {
    // << 보드 ID 매핑
    manager: '1bZD1_-sf-DqFDlxdc_PHxMD2hiqpglP_nP1zZkg54M4', // << 관리자 보드 ID
  },
  PDF_FOLDER: '1YtKF17v6wi7sVQ0SRT-MIBfwGKFg5tqW', // << PDF 저장 폴더 ID
}; // << CFG 객체 끝

const ss = SpreadsheetApp.getActive(); // << 현재 활성 스프레드시트 참조
const data = () => ss.getSheetByName(CFG.DATA); // << 데이터 시트 가져오는 함수
const tpl = () => ss.getSheetByName(CFG.TEMPLATE); // << 템플릿 시트 가져오는 함수

/**
 * baseName 또는 baseName(n) 형태의 시트 중
 * 숫자 n이 가장 큰(가장 최근 생성된) 시트를 반환
 */
function getLatestSheet(baseName) {
  // 이건 여러 설문이 와서 하나의 문서에 합쳐질때만 사용
  // 1) baseName 내의 정규식 메타문자(.( ) [ ] 등)를 이스케이프
  const escaped = baseName.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
  // 2) "(n)" 까지 매칭하는 정규식 생성
  const regex = new RegExp(`^${escaped}(?:\\((\\d+)\\))?$`);

  let latestName = null,
    maxNum = -1;
  ss.getSheets().forEach(s => {
    const m = s.getName().match(regex);
    if (!m) return; // 매칭 안 되면 스킵
    const num = m[1] ? parseInt(m[1], 10) : 0; // 괄호 안 숫자 or 기본(0)
    if (num > maxNum) {
      maxNum = num; // 최대 숫자 갱신
      latestName = s.getName(); // 해당 시트명 저장
    }
  });
  // 3) 가장 최근 이름의 시트 객체 반환 or null
  return latestName ? ss.getSheetByName(latestName) : null;
}

/******** 1. 양식 제출 시 – 팀장 보드로 ********/ // << 폼 제출 트리거 부분 시작
function onFormSubmit(e) {
  const row = e.range.getRow(); // 이벤트 발생 행
  const status = data().getRange(row, 17).getValue().toString().trim(); // Q열: 상태
  Logger.log(
    `▶ row=${row}, raw status(col17)=[${data().getRange(row, 17).getValue()}], trimmed=[${status}]`
  );

  if (status === '오전') {
    const owner = data().getRange(row, 2).getValue().toString().trim(); // L열: 주문자
    const timestamp = data().getRange(row, 1).getValue().toString().trim(); // C열: 제품명
    const formatted = Utilities.formatDate(
      new Date(timestamp),
      Session.getScriptTimeZone(),
      'yyyy-MM-dd'
    );
    const baseName = `${owner}_${formatted}`.replace(/[/\\?%*:|"<>]/g, '-'); // 기본 시트명 조합

    let uniqueName = baseName,
      i = 1; // 첫 시도는 baseName
    while (ss.getSheetByName(uniqueName)) {
      // 중복 시
      uniqueName = `${baseName}(${i++})`; // “baseName(1)”, “(2)”…
    }

    const s = tpl().copyTo(ss).setName(uniqueName); // 유니크 이름으로 시트 생성
    s.getRange('c6').setValue(data().getRange(row, 1).getValue()); // C6에 타임스탬프 기록
    data().getRange(row, 18).setValue(uniqueName); // ▶ R열(18)에 uniqueName 저장
    return; // 이후 로직 스킵
  } else if (status === '오후') {
    // O열에 기록된 uniqueName 우선, 없으면 가장 최근 생성된 시트로 폴백
    const row = e.range.getRow();
    const timestamp = data().getRange(row, 1).getValue(); // ← 여기에 Date 객체로 선언
    let sheetName = data().getRange(row, 18).getDisplayValue().trim(); // ▶ R열에서 uniqueName 읽기

    if (!sheetName) {
      const owner = data().getRange(row, 2).getValue().toString().trim(); // L열: 주문자
      const formatted = Utilities.formatDate(
        new Date(timestamp),
        Session.getScriptTimeZone(),
        'yyyy-MM-dd'
      );
      const baseName = `${owner}_${formatted}`.replace(/[/\\?%*:|"<>]/g, '-'); // 기본 시트명 조합
      const shLatest = getLatestSheet(baseName); // 최근 시트 객체
      if (!shLatest) return;
      sheetName = shLatest.getName();
    }
    const sh = ss.getSheetByName(sheetName); // ▶ 정확히 해당 시트만 조회
    if (!sh) return;

    // 기존 시트의 E6에 timestamp 그대로 기록
    sh.getRange('E6').setValue(timestamp);

    // (이후 팀장 보드 전송 로직)
    const sheetUrl = ss.getUrl().replace(/\/edit.*$/, '') + `/edit?gid=${sh.getSheetId()}`; // ▶ URL 재계산
    data()
      .getRange(row, CFG.COL.CEO)
      .setFormula(`=IFERROR(VLOOKUP(B${row}, '${CFG.LOOKUP}'!B:H, 5, FALSE),"")`); // 팀장 이름 매핑
    SpreadsheetApp.flush();
    const leader = data().getRange(row, CFG.COL.CEO).getDisplayValue().trim(); // 매핑된 팀장
    if (leader) {
      const info = lookupBoardByName(leader); // 보드 ID 조회
      if (info) pushToBoard(info.boardId, 'leader', row, sheetUrl); // 보드 전송
    }
    return;
  }
}

function doGet(e) {
  try {
    const role = e.parameter.role;
    const row = parseInt(e.parameter.row, 10);
    if (!role || !row) throw new Error('param err');

    if (role === 'leader') {
      const leaderName = data().getRange(row, CFG.COL.CEO).getDisplayValue().trim();
      insertSig(row, CFG.COL.CEO_SIG, leaderName);
      SpreadsheetApp.flush();

      exportPdfAndNotify(row);
    }
    return HtmlService.createHtmlOutput('OK');
  } catch (err) {
    // 로그로 에러 상세 남기기
    console.error('doGet error:', err, 'parameters:', e);
    return HtmlService.createHtmlOutput('Error: ' + err.message);
  }
}

/********** 2) 웹앱 진입점 – doGet **********/
//function doGet(e) {
//  const role = e.parameter.role;
//  const row  = parseInt(e.parameter.row, 10);
//  if (!role || !row) return out('param err');
//
//  console.log('doGet 호출 → role=' + role + ', row=' + row);

//  if (role === 'leader') {
//    const leaderName = data().getRange(row, CFG.COL.CEO).getDisplayValue().trim();
//    insertSig(row, CFG.COL.CEO_SIG, leaderName);
//    SpreadsheetApp.flush();

//    exportPdfAndNotify(row);

//  }
//}

function out(msg) {
  return HtmlService.createHtmlOutput(msg);
}

/******** 4. LOOKUP 서명 수식 ********/
function insertSig(row, col, name) {
  const f = `=IFERROR(VLOOKUP("${name}", '${CFG.LOOKUP}'!B:E, 4, FALSE),"서명없음")`;
  data().getRange(row, col).setFormula(f);
  SpreadsheetApp.flush();
}

/********* 이름→보드ID 매핑 *********/ // << 보드 ID 조회 함수
function lookupBoardByName(name) {
  // << 이름으로 보드 ID 찾기
  const mapSh = ss.getSheetByName(CFG.MAP_ID); // << 매핑 시트 가져오기
  const last = mapSh.getLastRow(); // << 마지막 행
  if (last < 2) return null; // << 데이터 없음
  const vals = mapSh.getRange(2, 2, last - 1, 2).getValues(); // << 매핑 값 읽기
  for (let [n, id] of vals) {
    // << 매핑 루프
    if (n.toString().trim() === name) return { boardId: id.toString().trim() }; // << 매칭 시 반환
  }
  return null; // << 없으면 null
}

/********* 스크립트ID→URL 매핑 *********/ // << 실행 URL 조회 함수
function lookupExecUrlByScriptId(scriptId) {
  // << 스크립트 ID로 URL 찾기
  const sh = ss.getSheetByName(CFG.MAP_ID); // << 매핑 시트
  const last = sh.getLastRow(); // << 마지막 행
  const rows = sh.getRange(2, 4, last - 1, 2).getDisplayValues(); // << ID-URL 읽기
  for (let [id, url] of rows) {
    // << 루프
    if (id === scriptId) return url; // << 일치 시 URL 반환
  }
  throw new Error(`C시트에서 스크립트ID=${scriptId}를 찾을 수 없습니다.`); // << 없으면 에러
}

/******** 7. 보드 전송 함수 ********/
function pushToBoard(boardId, role, srcRow, url) {
  // << 보드에 항목 추가

  const masterId = ss.getId(); // << 마스터 스프레드시트 ID
  const sh = SpreadsheetApp.openById(boardId).getSheets()[0]; // << 보드 시트
  const dstRow = sh.getLastRow() + 1;
  const ts = new Date();
  const docName = '온습도 점검표(대시보드)';
  const name = data().getRange(srcRow, 2).getValue();
  const type     = data().getRange(srcRow, 18).getValue();
  // const start    = data().getRange(srcRow, 7).getValue();
  // const end      = data().getRange(srcRow, 8).getValue();
  //const reason   = data().getRange(srcRow,10).getValue();
  sh.getRange(dstRow, 1, 1, 4).setValues([[ts, docName, name, type]]);
  sh.getRange(dstRow, 1).setNumberFormat('yyyy-MM-dd HH:mm:ss');
  sh.getRange(dstRow, 11).setValue(srcRow);
  if (url) sh.getRange(dstRow, 15).setValue(url);
  if (role !== 'manager') {
    const imp = colLetter => `=IMPORTRANGE("${masterId}", "A시트!${colLetter}${srcRow}")`;
    sh.getRange(dstRow, 8).setFormula(imp('o'));
    // sh.getRange(dstRow, 9).setFormula(imp('z'));
    //sh.getRange(dstRow,10).setFormula(imp('Q'));
    sh.getRange(dstRow, 12).insertCheckboxes();
  } else {
    sh.getRange(dstRow, 8).setValue(fileUrl);
    sh.getRange(dstRow, 10).insertCheckboxes();
  }
}

function exportPdfAndNotify(row) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    // ① 시트 찾기
    let sheetName = data().getRange(row, 18).getDisplayValue().trim();
    if (!sheetName) {
      const owner = data().getRange(row, 2).getValue().toString().trim();
      const ts = data().getRange(row, 1).getValue();
      const formatted = Utilities.formatDate(ts, Session.getScriptTimeZone(), 'yyyy-MM-dd');
      const baseName = `${owner}_${formatted}`.replace(/[/\\?%*:|"<>]/g, '-');
      const shLatest = getLatestSheet(baseName);
      if (!shLatest) throw new Error('시트를 찾을 수 없습니다: ' + baseName);
      sheetName = shLatest.getName();
    }
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) throw new Error('시트를 찾을 수 없습니다: ' + sheetName);

    // ② PDF URL 생성 & Blob 가져오기
    const baseUrl = ss.getUrl().replace(/\/edit$/, '');
    const pdfUrl = `${baseUrl}/export?format=pdf&gid=${sheet.getSheetId()}&size=A4`;
    const blob = UrlFetchApp.fetch(pdfUrl, {
      headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
    }).getBlob();

    // ③ Drive에 업로드
    const file = DriveApp.getFolderById(CFG.PDF_FOLDER).createFile(
      blob.setName(`온습도 점검표_${sheetName}.pdf`)
    );

    // ④ 시트 삭제
    ss.deleteSheet(sheet);
  } finally {
    lock.releaseLock();
  }
}
