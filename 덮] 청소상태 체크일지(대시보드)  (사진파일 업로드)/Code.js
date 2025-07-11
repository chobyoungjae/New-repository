

function logRangeAD16toD37Size() {
  const ss = SpreadsheetApp.getActive();
  const sh = ss.getSheetByName('문서');
  if (!sh) {
    Logger.log('시트 "문서"를 찾을 수 없습니다.');
    return;
  }

  const range = sh.getRange('E16:H37');
  const startCol = range.getColumn();
  const numCols = range.getNumColumns();
  let totalWidth = 0;
  for (let i = 0; i < numCols; i++) {
    totalWidth += sh.getColumnWidth(startCol + i);
  }

  const startRow = range.getRow();
  const numRows = range.getNumRows();
  let totalHeight = 0;
  for (let i = 0; i < numRows; i++) {
    totalHeight += sh.getRowHeight(startRow + i);
  }

  Logger.log(`문서!A16:D37 범위 크기 = ${totalWidth}px × ${totalHeight}px`);
}

function testOnFormSubmit() {
  const row = 23; // ← 임의로 테스트할 행 번호
  const fakeE = { range: data().getRange(row, 1) };
  onFormSubmit(fakeE);
}

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
  PDF_FOLDER: '1kw4i7jkr6jFLn2gcUjoMBunkmBXxlmrw', // << PDF 저장 폴더 ID
}; // << CFG 객체 끝

const ss = SpreadsheetApp.getActive(); // << 현재 활성 스프레드시트 참조
const data = () => ss.getSheetByName(CFG.DATA); // << 데이터 시트 가져오는 함수
const tpl = () => ss.getSheetByName(CFG.TEMPLATE); // << 템플릿 시트 가져오는 함수

// ▶ extractId 유틸 함수 (맨 위나 CONFIG 아래에 선언)          << /*  유틸: Drive URL → 파일 ID */
function extractId(url) {
  if (!url) return '';
  const m = url.toString().match(/[-\w]{25,}/);
  return m ? m[0] : '';
}

function onFormSubmit(e) {
  // << 폼 제출 시 호출
  const row = e.range.getRow(); // << 제출된 행 번호
  let sheetUrl = ''; // << 개인 시트 URL 초기화

  // ▶ 시트명용 데이터 추출
  const owner = data().getRange(row, 2).getValue().toString().trim(), // B열: 주문자
    line = data().getRange(row, 3).getValue().toString().trim(), // C열: 라인
    product = data().getRange(row, 5).getValue().toString().trim(); // E열: 제품명

  if (owner && line && product) {
    // << 네 값 모두 있을 때만 실행
    // ▶ 기본 시트명 조합 + 불가문자 치환
    const baseName = `${line}_${product}`.replace(/[/\\?%*:|"<>]/g, '-'); // << “주문자_제품명_중량_로트” 형태

    // ▶ 중복 시 “(1)”, “(2)”… 붙여 유니크하게
    let uniqueName = baseName,
      i = 1; // << 기본 이름 + 카운터
    while (ss.getSheetByName(uniqueName)) {
      uniqueName = `${baseName}(${i++})`; // << 중복 발견 시 숫자 증가
    }

    // ▶ 템플릿 복사 + 이름 설정 + 타임스탬프 삽입
    const s = tpl().copyTo(ss).setName(uniqueName); // << 개인 시트 생성
    s.getRange('B3').setValue(data().getRange(row, 1).getValue()); // << B3에 타임스탬프 기록
    data().getRange(row, 19).setValue(uniqueName); // ▶ 19 에 uniqueName 저장

    // ▶ 이미지 삽입 (여기에 넣으세요)
    try {
      const iId = extractId(data().getRange(row, 9).getValue());
      if (iId) {
        const iBlob = UrlFetchApp.fetch(`https://drive.google.com/thumbnail?sz=w400&id=${iId}`, {
          headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
        }).getBlob();
        const iImg = s.insertImage(iBlob, 1, 14);
        iImg.setWidth(480).setHeight(350);
      }

      const jId = extractId(data().getRange(row, 10).getValue());
      if (jId) {
        const jBlob = UrlFetchApp.fetch(`https://drive.google.com/thumbnail?sz=w400&id=${jId}`, {
          headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
        }).getBlob();
        const jImg = s.insertImage(jBlob, 4, 14);
        jImg.setWidth(500).setHeight(350);
      }

      const kId = extractId(data().getRange(row, 11).getValue());
      if (kId) {
        const kBlob = UrlFetchApp.fetch(`https://drive.google.com/thumbnail?sz=w400&id=${kId}`, {
          headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
        }).getBlob();
        const kImg = s.insertImage(kBlob, 1, 32);
        kImg.setWidth(980).setHeight(395);
      }
    } catch (err) {
      Logger.log('이미지 삽입 오류: ' + err);
    }

    // ▶ 개인 시트 URL 생성 (필요 시 활용)
    sheetUrl = ss.getUrl().replace(/\/edit.*$/, '') + `/edit?gid=${s.getSheetId()}`; // << 개인 시트 링크
    // data().getRange(row, 15).setValue(sheetUrl);                     // << URL 저장은 생략 가능
  }

  // ▶ 팀장명 셋업
  data()
    .getRange(row, CFG.COL.CEO)
    .setFormula(`=IFERROR(VLOOKUP(B${row}, '${CFG.LOOKUP}'!B:H, 5, FALSE),"")`);
  SpreadsheetApp.flush(); // << 변경사항 강제 반영

  // ▶ 보드로 전송
  const leader = data().getRange(row, CFG.COL.CEO).getDisplayValue().trim(); // << 매핑된 팀장 이름
  if (leader) {
    // << 팀장 이름이 있을 경우
    const info = lookupBoardByName(leader); // << 보드 정보 조회
    if (info) pushToBoard(info.boardId, 'leader', row, sheetUrl); // << 보드에 전송
    else Logger.log('⚠ 매핑된 팀장 보드가 없습니다: ' + leader); // << 매핑 실패 로그
  }
}

/********** 2) 웹앱 진입점 – doGet **********/
function doGet(e) {
  const role = e.parameter.role;
  const row = parseInt(e.parameter.row, 10);
  if (!role || !row) return out('param err');

  console.log('doGet 호출 → role=' + role + ', row=' + row);

  if (role === 'leader') {
    const leaderName = data().getRange(row, CFG.COL.CEO).getDisplayValue().trim();
    insertSig(row, CFG.COL.CEO_SIG, leaderName);
    SpreadsheetApp.flush();

    exportPdfAndNotify(row);
  }
}

/********* 서명 수식 삽입 *********/ // << 서명 수식 삽입 함수
function insertSig(row, col, name) {
  // << 지정된 셀에 서명 수식 넣기
  const f = `=IFERROR(VLOOKUP("${name}", '${CFG.LOOKUP}'!B:E, 4, FALSE),"서명없음")`; // << 서명 수식 생성
  data().getRange(row, col).setFormula(f); // << 수식 삽입
  SpreadsheetApp.flush(); // << 반영
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

/********* 보드 전송 함수 *********/ // << 보드에 데이터 전송 함수
function pushToBoard(boardId, role, srcRow, url) {
  // << 보드에 항목 추가
  const masterId = ss.getId(); // << 마스터 스프레드시트 ID
  const sh = SpreadsheetApp.openById(boardId).getSheets()[0]; // << 보드 시트
  const dstRow = sh.getLastRow() + 1; // << 추가할 행번호

  // 1) A~G 값 쓰기
  const ts = new Date(); // << 타임스탬프
  const docName = '청소상태 체크일지(대시보드)'; // << 문서명
  const vals = [
    ts,
    docName,
    data().getRange(srcRow, 2).getValue(), // << 전송할 데이터
    data().getRange(srcRow, 19).getValue(),
  ]; // << 전송할 데이터
  sh.getRange(dstRow, 1, 1, 4).setValues([vals]).setNumberFormat('yyyy/MM/dd HH:mm:ss'); // << 쓰기 및 서식 적용

  // 2) 원본 행 번호 및 개인 시트 URL
  sh.getRange(dstRow, 11).setValue(srcRow); // << 원본 행 기록
  if (url) sh.getRange(dstRow, 15).setValue(url); // << 개인 시트 링크 기록

  // 3) IMPORTRANGE 설정
  const imp = c => `=IMPORTRANGE("${masterId}","A시트!${c}${srcRow}")`; // << IMPORTRANGE 수식
  sh.getRange(dstRow, 8).setFormula(imp('O')); // << 서명자
  // sh.getRange(dstRow,9).setFormula(imp('O')); // << 다음 서명자
  // sh.getRange(dstRow,10).setFormula(imp('Q')); // << 최종 서명자

  // 4) 체크박스
  sh.getRange(dstRow, 12).insertCheckboxes(); // << 체크박스 삽입

  // 5) 서명 하이퍼링크
  const execUrl = lookupExecUrlByScriptId(ScriptApp.getScriptId()); // << 실행 URL 조회
  sh.getRange(dstRow, 13).setFormula(`=HYPERLINK("${execUrl}?role=${role}&row=${srcRow}","")`); // << 서명 버튼 링크
}

/********* PDF 생성 및 알림 *********/ // << PDF 생성 및 Drive 업로드
function exportPdfAndNotify(row) {
  // << PDF 생성 후 폴더에 저장
  const lock = LockService.getScriptLock();
  lock.waitLock(30000); // << 동시 실행 방지
  try {
    // ▶ 19열에서 실제 시트명 읽기
    const sheetName = data().getRange(row, 19).getDisplayValue().trim();
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) throw new Error('개인 시트를 찾을 수 없습니다: ' + sheetName);

    const baseUrl = ss.getUrl().replace(/\/edit$/, ''); // << 기본 URL
    const gid = sheet.getSheetId(); // << 시트 ID
    const pdfUrl =
      baseUrl +
      '/export?format=pdf' +
      '&gid=' +
      gid + // 출력할 시트 ID
      '&size=A4' + // 용지 크기
      '&portrait=true' + // 세로 방향
      '&scale=4' + // 4 = Fit to Page
      '&top_margin=0.2' + // 여백 최소화
      '&bottom_margin=0.2' +
      '&left_margin=0.2' +
      '&right_margin=0.2' +
      '&gridlines=false' + // 격자선 숨김
      '&sheetnames=false' + // 시트 이름 숨김
      '&printtitle=false' + // 스프레드시트 제목 숨김
      '&horizontal_alignment=CENTER' + // 가로 중앙 정렬:contentReference[oaicite:0]{index=0}
      '&vertical_alignment=MIDDLE';

    const blob = UrlFetchApp.fetch(pdfUrl, {
      headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
    }).getBlob(); // << PDF Blob 가져오기

    const ts = data().getRange(row, 1).getValue(); // << 타임스탬프
    const formatted = Utilities.formatDate(
      new Date(ts),
      Session.getScriptTimeZone(),
      'yyyy-MM-dd_HH:mm:ss'
    ); // << 파일명 포맷
    blob.setName(`청소상태 체크일지(대시보드)_${formatted}_${sheetName}.pdf`); // << Blob 이름 설정
    DriveApp.getFolderById(CFG.PDF_FOLDER).createFile(blob); // << Drive 업로드

    // ④ PDF 생성에 성공한 경우에만 시트 삭제
    ss.deleteSheet(sheet); // << 방금 생성된 개인 시트 삭제
  } finally {
    lock.releaseLock(); // << 락 해제
  }
}

function testExportPdf40() {
  // << 테스트용 PDF 생성 함수
  exportPdfAndNotify(18); // << 25행 테스트
}
