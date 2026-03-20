/**************** CONFIG ****************/
const CFG = {
  DATA: 'A시트', // 메인 데이터 시트
  TEMPLATE: '문서', // 개인 템플릿 시트
  LOOKUP: 'B시트', // 이름→팀장/서명 매핑 시트
  MAP_ID: '문서ID', // 스프레드시트ID→스크립트ID→URL 매핑 시트
  COL: {
    CEO: 17, // Q열: 팀장 컬럼
    CEO_SIG: 18, // R열: 팀장 서명 컬럼
  },
  PDF_FOLDER: '1iwIgwJCc2t2-LSK-eIFnXOFL2ntFaiaJ', // PDF 저장 폴더 ID
};

// 전역 캐싱
const ss = SpreadsheetApp.getActive();
const data = () => ss.getSheetByName(CFG.DATA);
const tpl = () => ss.getSheetByName(CFG.TEMPLATE);
const out = msg => ContentService.createTextOutput(msg);

// 룩업 테이블 캐시
let boardLookupCache = new Map();
let execUrlCache = new Map();
let cacheTimestamp = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5분

/**
 * baseName 또는 baseName(n) 형태의 시트 중
 * 숫자 n이 가장 큰(가장 최근 생성된) 시트를 반환
 */
function getLatestSheet(baseName) {
  const escaped = baseName.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
  const regex = new RegExp(`^${escaped}(?:\\((\\d+)\\))?$`);

  let latestName = null,
    maxNum = -1;
  ss.getSheets().forEach(s => {
    const m = s.getName().match(regex);
    if (!m) return;
    const num = m[1] ? parseInt(m[1], 10) : 0;
    if (num > maxNum) {
      maxNum = num;
      latestName = s.getName();
    }
  });
  return latestName ? ss.getSheetByName(latestName) : null;
}

/**
 * 주문 데이터로부터 기본 시트명 생성
 */
function generateBaseName(row) {
  const rowData = data().getRange(row, 3, 1, 10).getValues()[0]; // C~L열 배치 읽기

  const product = rowData[0].toString().trim(); // C열: 제품명
  const dValue = rowData[1].toString().trim(); // D열
  const weightVal = rowData[2].toString().trim(); // E열: 중량
  const weight = `${weightVal}g`;
  const expiryRaw = rowData[5]; // H열: 유통기한
  const lot = rowData[6].toString().trim(); // I열: 로트
  const line = rowData[9].toString().trim(); // L열: 라인

  const expiry = Utilities.formatDate(new Date(expiryRaw), Session.getScriptTimeZone(), 'yy.MM.dd');

  return `${line}_${product}_${dValue}_${expiry}_${lot}_${weight}`.replace(/[/\\?%*:|"<>]/g, '-');
}

/**
 * 행 데이터를 기반으로 시트명을 찾거나 생성
 */
function findOrCreateSheetName(row) {
  let sheetName = data().getRange(row, 15).getDisplayValue().trim(); // O열에서 uniqueName 읽기
  const baseName = generateBaseName(row);

  // O열이 비어있거나 해당 시트명이 존재하지 않으면 fallback 실행
  if (!sheetName || !ss.getSheetByName(sheetName)) {
    const shLatest = getLatestSheet(baseName);
    if (!shLatest) return null;
    sheetName = shLatest.getName();
    data().getRange(row, 15).setValue(sheetName); // O열에 기록
  }

  return sheetName;
}

/******** 1. 양식 제출 시 – 팀장 보드로 ********/
function onFormSubmit(e) {
  const row = e.range.getRow();
  const status = data().getRange(row, 2).getValue().toString().trim(); // B열: 상태

  try {
    if (status === '작업 시작 시') {
      const baseName = generateBaseName(row);

      let uniqueName = baseName,
        i = 1;
      while (ss.getSheetByName(uniqueName)) {
        uniqueName = `${baseName}(${i++})`;
      }

      const s = tpl().copyTo(ss).setName(uniqueName);
      s.getRange('M10').setValue(data().getRange(row, 1).getValue()); // M10에 타임스탬프
      data().getRange(row, 15).setValue(uniqueName); // O열에 uniqueName 저장
      return;

    } else if (status === '작업 중') {
      const sheetName = findOrCreateSheetName(row);
      if (!sheetName) return;

      const sh = ss.getSheetByName(sheetName);
      if (!sh) return;

      const mVals = sh.getRange('M10:M').getValues().flat();
      const nextRow = 10 + mVals.filter(v => v !== '').length;
      sh.getRange(`M${nextRow}`).setValue(data().getRange(row, 1).getValue());
      return;

    } else if (status === '제품생산 완료') {
      // ① 시트 찾기 + 타임스탬프 기록
      const sheetName = findOrCreateSheetName(row);
      if (!sheetName) return;

      const sh = ss.getSheetByName(sheetName);
      if (!sh) return;

      const mVals = sh.getRange('M10:M').getValues().flat();
      const nextRow = 10 + mVals.filter(v => v !== '').length;
      sh.getRange(`M${nextRow}`).setValue(data().getRange(row, 1).getValue());

      // ② 팀장 이름 매핑 (Q열 드롭다운이므로 값 직접 입력)
      const fValue = data().getRange(row, 6).getDisplayValue().trim();
      const lookupSheet = ss.getSheetByName(CFG.LOOKUP);
      const lookupData = lookupSheet.getRange(2, 2, lookupSheet.getLastRow() - 1, 5).getValues(); // B~F열
      let leader = '';
      for (const row_ of lookupData) {
        if (row_[0].toString().trim() === fValue) {
          leader = row_[4].toString().trim(); // F열 (팀장)
          break;
        }
      }

      if (leader) {
        data().getRange(row, CFG.COL.CEO).setValue(leader);
        SpreadsheetApp.flush();
      }

      if (!leader) return;

      // ③ 보드 ID 조회
      const info = lookupBoardByName(leader);
      if (!info) return;

      // ④ 보드 전송
      pushToBoard(info.boardId, 'leader', row);
      return;
    }
  } catch (error) {
    console.log(`[onFormSubmit] 오류 - row: ${row}, status: "${status}", error: ${error.message}, stack: ${error.stack}`);
  }
}

/********** 2) 웹앱 진입점 – doGet **********/
function doGet(e) {
  const lock = LockService.getScriptLock();

  try {
    const lockAcquired = lock.tryLock(30000);
    if (!lockAcquired) return out('busy - try again later');

    const role = e.parameter.role;
    const row = parseInt(e.parameter.row, 10);

    if (!role || !row) return out('param err');

    if (role === 'leader') {
      const leaderName = data().getRange(row, CFG.COL.CEO).getDisplayValue().trim();
      insertSig(row, CFG.COL.CEO_SIG, leaderName);
      SpreadsheetApp.flush();

      exportPdfAndNotify(row);
      return out('success');
    } else {
      return out('invalid role');
    }
  } catch (error) {
    console.log(`[doGet] 오류 - row: ${e.parameter.row}, error: ${error.message}`);
    return out(`error: ${error.message}`);
  } finally {
    if (lock) lock.releaseLock();
  }
}

/********* 서명 수식 삽입 *********/
function insertSig(row, col, name) {
  const f = `=IFERROR(VLOOKUP("${name}", '${CFG.LOOKUP}'!B:E, 4, FALSE),"서명없음")`;
  data().getRange(row, col).setFormula(f);
  SpreadsheetApp.flush();
}

/********* 이름→보드ID 매핑 (캐시 적용) *********/
function lookupBoardByName(name) {
  const now = Date.now();
  if (now - cacheTimestamp > CACHE_DURATION) {
    refreshBoardLookupCache();
    cacheTimestamp = now;
  }
  const boardId = boardLookupCache.get(name);
  return boardId ? { boardId } : null;
}

function refreshBoardLookupCache() {
  boardLookupCache.clear();
  const mapSh = ss.getSheetByName(CFG.MAP_ID);
  const last = mapSh.getLastRow();
  if (last < 2) return;

  const vals = mapSh.getRange(2, 2, last - 1, 2).getValues();
  for (let [n, id] of vals) {
    if (n && id) boardLookupCache.set(n.toString().trim(), id.toString().trim());
  }
}

/********* 스크립트ID→URL 매핑 (캐시 적용) *********/
function lookupExecUrlByScriptId(scriptId) {
  const now = Date.now();
  if (now - cacheTimestamp > CACHE_DURATION) {
    refreshExecUrlCache();
  }

  const url = execUrlCache.get(scriptId);
  if (url) return url;

  throw new Error(`문서ID 시트에서 스크립트ID=${scriptId}를 찾을 수 없습니다.`);
}

function refreshExecUrlCache() {
  execUrlCache.clear();
  const sh = ss.getSheetByName(CFG.MAP_ID);
  const last = sh.getLastRow();
  if (last < 2) return;

  const rows = sh.getRange(2, 4, last - 1, 2).getDisplayValues();
  for (let [id, url] of rows) {
    if (id && url) execUrlCache.set(id, url);
  }
}

/********* 보드 전송 함수 *********/
function pushToBoard(boardId, role, srcRow) {
  const masterId = ss.getId();
  const sh = SpreadsheetApp.openById(boardId).getSheets()[0];

  // A열 타임스탬프 기준 실제 데이터 마지막 행 찾기
  const aValues = sh.getRange('A:A').getValues();
  let lastDataRow = 0;
  for (let i = aValues.length - 1; i >= 0; i--) {
    if (aValues[i][0] !== '') {
      lastDataRow = i + 1;
      break;
    }
  }
  const dstRow = lastDataRow + 1;

  // 1) A~D 값 쓰기
  const ts = new Date();
  const docName = '1동 제품검수일지(대시보드)';
  const sourceData = data().getRange(srcRow, 6, 1, 10).getValues()[0]; // F~O열
  const uniqueName = sourceData[9].toString().trim(); // O열 (uniqueName)

  // uniqueName으로 시트 GID 조회 → 클릭하면 해당 시트로 이동하는 URL 생성
  const targetSheet = ss.getSheetByName(uniqueName);
  const sheetUrl = targetSheet
    ? `https://docs.google.com/spreadsheets/d/${masterId}/edit#gid=${targetSheet.getSheetId()}&range=A1`
    : uniqueName; // 시트 없으면 이름만 표시

  const vals = [
    ts,
    docName,
    sourceData[0], // F열
    uniqueName, // D열: 유니크네임
  ];
  sh.getRange(dstRow, 1, 1, 4).setValues([vals]).setNumberFormat('yyyy/MM/dd HH:mm:ss');

  // 2) O열(15): 시트 URL (클릭 시 해당 시트로 이동)
  sh.getRange(dstRow, 15).setValue(sheetUrl);

  // 3) 원본 행 번호 (PDF는 서명 완료 시에만 생성)
  sh.getRange(dstRow, 11).setValue(srcRow); // K열

  // 4) IMPORTRANGE - 서명 상태 연동
  const imp = c => `=IMPORTRANGE("${masterId}","A시트!${c}${srcRow}")`;
  sh.getRange(dstRow, 8).setFormula(imp('r')); // H열: 서명자

  // 5) 체크박스
  sh.getRange(dstRow, 12).insertCheckboxes();

  // 6) 서명 하이퍼링크
  const execUrl = lookupExecUrlByScriptId(ScriptApp.getScriptId());
  sh.getRange(dstRow, 13).setFormula(`=HYPERLINK("${execUrl}?role=${role}&row=${srcRow}","")`);
}

/********* PDF 생성 함수 *********/
function createPdfFromSheet(row, customFolderId = null) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    // ① 시트 찾기
    const sheetName = findOrCreateSheetName(row);
    if (!sheetName) throw new Error('시트를 찾을 수 없습니다');

    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) throw new Error('시트를 찾을 수 없습니다: ' + sheetName);

    // ② PDF URL 구성 및 Blob 생성
    const baseUrl = ss.getUrl().replace(/\/edit$/, '');
    const gid = sheet.getSheetId();
    const pdfUrl = `${baseUrl}/export?format=pdf&gid=${gid}&size=A4&portrait=true&scale=4&top_margin=0.2&bottom_margin=0.2&left_margin=0.2&right_margin=0.2&gridlines=false&sheetnames=false&printtitle=false&horizontal_alignment=CENTER&vertical_alignment=MIDDLE&r1=0&r2=15&c1=0&c2=9`;

    const blob = UrlFetchApp.fetch(pdfUrl, {
      headers: { Authorization: `Bearer ${ScriptApp.getOAuthToken()}` },
    }).getBlob();

    // ③ 파일명 설정
    const ts = data().getRange(row, 1).getValue();
    const formatted = Utilities.formatDate(new Date(ts), Session.getScriptTimeZone(), 'yyyy-MM-dd_HH:mm:ss');
    const fileName = `1동 제품검수일지(대시보드)_${formatted}_${sheetName}.pdf`;
    blob.setName(fileName);

    // ④ 새 PDF 파일 생성
    const folderId = customFolderId || CFG.PDF_FOLDER;
    const folder = DriveApp.getFolderById(folderId);
    const pdfFile = folder.createFile(blob);

    return pdfFile.getId();
  } finally {
    lock.releaseLock();
  }
}

/********* 서명 완료 후 PDF 생성 및 시트 삭제 *********/
function exportPdfAndNotify(row) {
  // 1) PDF 생성 (서명 완료 후 최종 폴더에 저장)
  const finalFolderId = '1LUi7lgAy3Uru4FbnB88hBxXIZ-Pb2NGE';
  const pdfFileId = createPdfFromSheet(row, finalFolderId);

  // 2) 시트 삭제
  const sheetName = data().getRange(row, 15).getDisplayValue().trim();
  if (!sheetName) return;

  const sheet = ss.getSheetByName(sheetName);
  if (sheet && ss.getSheets().length > 1) {
    ss.deleteSheet(sheet);
    SpreadsheetApp.flush();
  }
}
