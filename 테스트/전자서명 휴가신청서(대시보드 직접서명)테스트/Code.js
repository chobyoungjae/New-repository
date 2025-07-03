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
    LEADER: 12, // << 팀장 컬럼 인덱스
    LEADER_SIG: 13, // << 팀장 서명 컬럼 인덱스
    REVIEWER: 14, // << 리뷰어 컬럼 인덱스
    REVIEWER_SIG: 15, // << 리뷰어 서명 컬럼 인덱스
    CEO: 16, // << CEO 컬럼 인덱스
    CEO_SIG: 17, // << CEO 서명 컬럼 인덱스
  },

  PDF_FOLDER: '1X4FSfEkNgl59qXOvS2SyEz_aH44xSc7X', // << PDF 저장 폴더 ID
  SIGN_FOLDER: '1USPbFAffUUP6G8AFmpNyH02YuK2umeXx', // << 서명 이미지 저장 폴더
}; // << CFG 객체 끝

const ss = SpreadsheetApp.getActive(); // << 현재 활성 스프레드시트 참조
const data = () => ss.getSheetByName(CFG.DATA); // << 데이터 시트 가져오는 함수
const tpl = () => ss.getSheetByName(CFG.TEMPLATE); // << 템플릿 시트 가져오는 함수

/******** 1. 양식 제출 시 – 팀장 보드로 ********/ // << 폼 제출 트리거 부분 시작
function onFormSubmit(e) {
  // << 폼 제출 시 호출 함수
  const row = e.range.getRow(); // << 제출된 행 번호
  let sheetUrl = ''; // << 개인 시트 URL 초기화

  // per-person 시트 생성 및 타임스탬프
  const owner = data().getRange(row, 2).getValue().toString().trim(); // << 신청자 이름 획득
  if (owner) {
    // << 신청자 이름이 있으면
    const old = ss.getSheetByName(owner); // << 기존 개인 시트 확인
    if (old) ss.deleteSheet(old); // << 기존 시트 삭제
    const s = tpl().copyTo(ss).setName(owner); // << 템플릿 복사 후 개인 시트 생성
    s.getRange('F5').setValue(data().getRange(row, 1).getValue()); // << 타임스탬프 삽입
    sheetUrl = ss.getUrl().replace(/\/edit.*$/, '') + `/edit?gid=${s.getSheetId()}`; // << 개인 시트 URL 생성
  }

  // 팀장명 셋업
  data()
    .getRange(row, CFG.COL.LEADER)
    .setFormula(`=VLOOKUP(B${row}, '${CFG.LOOKUP}'!B:H, 5, FALSE)`); // << 팀장 이름 매핑
  SpreadsheetApp.flush(); // << 변경사항 강제 반영

  // 보드로 전송
  const leader = data().getRange(row, CFG.COL.LEADER).getDisplayValue().trim(); // << 매핑된 팀장 이름
  if (leader) {
    // << 팀장 이름이 있을 경우
    const info = lookupBoardByName(leader); // << 보드 정보 조회
    if (info) pushToBoard(info.boardId, 'leader', row, sheetUrl); // << 보드에 전송
    else Logger.log('⚠ 매핑된 팀장 보드가 없습니다: ' + leader); // << 매핑 실패 로그
  }
}

/******** 2. 역할별 흐름 – Web App 호출 ********/ // << 역할별 처리 Web App 시작
function doGet(e) {
  const row = e.parameter.row;
  const role = e.parameter.role;
  if (!row || !role) return HtmlService.createHtmlOutput('잘못된 접근입니다.');

  const template = HtmlService.createTemplateFromFile('popup');
  template.row = row;
  template.role = role;
  return template.evaluate().setWidth(420).setHeight(300);
}

/********* 서명 수식 삽입 *********/ // << 서명 수식 삽입 함수                                @@@@@@@@@@@@@@@@@@ 대시보드 클릭서명시에
// function insertSig(row, col, name) { // << 지정된 셀에 서명 수식 넣기
//  const f = `=IFERROR(VLOOKUP("${name}", '${CFG.LOOKUP}'!B:E, 4, FALSE),"서명없음")`; // << 서명 수식 생성
//  data().getRange(row, col).setFormula(f); // << 수식 삽입
//  SpreadsheetApp.flush(); // << 반영
//}

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

/********* 개인 시트 URL 계산 *********/ // << 개인 시트 URL 계산 함수
function getPersonalSheetUrl(row) {
  const owner = data().getRange(row, 2).getDisplayValue().trim(); // << 신청자 이름
  if (!owner) return ''; // << 이름 없으면 빈 문자열
  const sh = ss.getSheetByName(owner); // << 개인 시트
  return sh
    ? ss.getUrl().replace(/\/edit.*$/, '') + `/edit?gid=${sh.getSheetId()}` // << URL
    : ''; // << 없으면 빈
}

/** ① 설정 시트 말고 config 에 직접 추가해 놓은 SIGN_FOLDER 사용 **/
function getSignFolder() {
  return DriveApp.getFolderById(CFG.SIGN_FOLDER);
}

/**
 * 3. saveSignature – 서명 이미지 저장 & 메인시트 반영
 */
function saveSignature(dataUrl, row, role) {
  Logger.log(
    '[saveSignature] row: ' +
      row +
      ', role: ' +
      role +
      ', dataUrl: ' +
      (dataUrl ? dataUrl.substring(0, 30) : 'null')
  );
  const blob = Utilities.newBlob(
    Utilities.base64Decode(dataUrl.split(',')[1]),
    'image/png',
    'sig.png'
  );
  // 역할별 이름 가져오기
  let name;
  if (role === 'leader') {
    name = data().getRange(row, CFG.COL.LEADER).getDisplayValue().trim(); // L열
  } else if (role === 'reviewer') {
    name = data().getRange(row, CFG.COL.REVIEWER).getDisplayValue().trim(); // N열
  } else if (role === 'ceo') {
    name = data().getRange(row, CFG.COL.CEO).getDisplayValue().trim(); // P열
  } else {
    name = data().getRange(row, 2).getDisplayValue().trim(); // fallback
  }
  // 파일명: 이름_역할.png
  const fileName = `${name}_${role}.png`;
  const folder = DriveApp.getFolderById(CFG.SIGN_FOLDER);
  // 기존 파일 삭제(덮어쓰기)
  const files = folder.getFilesByName(fileName);
  while (files.hasNext()) {
    const oldFile = files.next();
    oldFile.setTrashed(true); // 휴지통으로 이동
  }
  // 새 파일 저장
  const file = folder.createFile(blob);
  file.setName(fileName);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  const url = `https://drive.google.com/uc?export=view&id=${file.getId()}`;
  const col =
    role === 'leader'
      ? CFG.COL.LEADER_SIG
      : role === 'reviewer'
      ? CFG.COL.REVIEWER_SIG
      : CFG.COL.CEO_SIG;
  Logger.log(
    `[saveSignature] setFormula target row: ${row}, col: ${col}, role: ${role}, url: ${url}`
  );
  data().getRange(row, col).setFormula(`=IMAGE("${url}")`);
  Logger.log(`[saveSignature] setFormula DONE row: ${row}, col: ${col}, role: ${role}`);

  if (role === 'leader') {
    data()
      .getRange(row, CFG.COL.REVIEWER)
      .setFormula(`=IFERROR(VLOOKUP(B${row}, '${CFG.LOOKUP}'!B:H, 6, FALSE),"")`);
    SpreadsheetApp.flush();
    const nextName = data().getRange(row, CFG.COL.REVIEWER).getDisplayValue().trim();
    const info = lookupBoardByName(nextName);
    if (info) pushToBoard(info.boardId, 'reviewer', row, getPersonalSheetUrl(row));
  } else if (role === 'reviewer') {
    data()
      .getRange(row, CFG.COL.CEO)
      .setFormula(`=IFERROR(VLOOKUP(B${row}, '${CFG.LOOKUP}'!B:H, 7, FALSE),"")`);
    SpreadsheetApp.flush();
    const nextName = data().getRange(row, CFG.COL.CEO).getDisplayValue().trim();
    const info = lookupBoardByName(nextName);
    if (info) pushToBoard(info.boardId, 'ceo', row, getPersonalSheetUrl(row));
  } else if (role === 'ceo') {
    updateRowInCalendar(data(), row);
    exportPdfAndNotify(row);
  }
}

/********* 보드 전송 함수 *********/ // << 보드에 데이터 전송 함수
function pushToBoard(boardId, role, srcRow, url) {
  const masterId = ss.getId();
  const sh = SpreadsheetApp.openById(boardId).getSheets()[0];
  const dstRow = sh.getLastRow() + 1;

  const ts = new Date();
  // const docName = data().getRange(srcRow, 2).getDisplayValue().trim(); // B열 문서명 (기존 코드 주석처리)
  const docTitle = '전자서명 휴가신청서(대시보드 전자서명)테스트';
  const vals = [
    ts,
    docTitle,
    data().getRange(srcRow, 2).getValue(), // 이름
    data().getRange(srcRow, 3).getValue(), // 부서
    data().getRange(srcRow, 7).getValue(), // 시작일
    data().getRange(srcRow, 8).getValue(), // 종료일
    data().getRange(srcRow, 10).getValue(), // 사유
  ];
  sh.getRange(dstRow, 1, 1, 7).setValues([vals]).setNumberFormat('yyyy/MM/dd HH:mm:ss');

  sh.getRange(dstRow, 11).setValue(srcRow); // K열: 원본 A시트 행번호
  if (url) sh.getRange(dstRow, 15).setValue(url); // O열: 개인시트 URL

  const imp = c => `=IMPORTRANGE("${masterId}","A시트!${c}${srcRow}")`;
  sh.getRange(dstRow, 8).setFormula(imp('M')); // H열
  sh.getRange(dstRow, 9).setFormula(imp('O')); // I열
  sh.getRange(dstRow, 10).setFormula(imp('Q')); // J열

  // 📱 sign-webapp(버셀) 서명 링크(M열=13열) 생성 (docName에 docTitle 사용)
  const webappUrl =
    'https://sign-webapp.vercel.app/sign/' +
    role +
    '?row=' +
    srcRow +
    '&role=' +
    role +
    '&docName=' +
    encodeURIComponent(docTitle);
  sh.getRange(dstRow, 13).setFormula(`=HYPERLINK("${webappUrl}", "서명하기")`);
}

/********* 캘린더 등록 *********/ // << 캘린더 등록 함수
function updateRowInCalendar(sheet, row) {
  // << 행을 캘린더에 등록
  if (sheet.getRange(row, 18).getValue() === '등록완료') return; // << 이미 등록된 경우 종료
  if (!sheet.getRange(row, CFG.COL.CEO_SIG).getValue()) return; // << CEO 서명 없으면 종료

  const cal = CalendarApp.getCalendarById('r023hniibcf6hqv2i3897umvn4@group.calendar.google.com'); // << 캘린더 ID
  if (!cal) {
    sheet.getRange(row, 18).setValue('캘린더 없음');
    return;
  } // << 캘린더 없으면 오류 기록

  const startDate = sheet.getRange(row, 7).getValue(); // << 시작 날짜
  const endDate = sheet.getRange(row, 8).getValue(); // << 종료 날짜
  if (!(startDate instanceof Date) || !(endDate instanceof Date)) {
    // << 날짜 형식 체크
    sheet.getRange(row, 18).setValue('날짜 오류');
    return; // << 오류 기록
  }

  const title = `${sheet.getRange(row, 2).getValue()} ${sheet.getRange(row, 6).getValue()} ${sheet
    .getRange(row, 3)
    .getValue()}`; // << 일정 제목 생성
  const desc = sheet.getRange(row, 10).getValue(); // << 일정 설명
  const team = sheet.getRange(row, 5).getValue(); // << 팀 정보
  const idCell = sheet.getRange(row, 19); // << 이벤트 ID 셀

  let ev;
  if (startDate.getTime() === endDate.getTime()) {
    // << 시작=종료 (하루 일정)
    ev = cal.createAllDayEvent(title, startDate); // << 하루짜리 이벤트
  } else {
    ev = cal.createAllDayEvent(title, startDate, new Date(endDate.getTime() + 86400000)); // << 기간 이벤트
  }
  ev.setDescription(desc).setColor(getColorId(team)); // << 설명 및 색상 설정
  idCell.setValue(ev.getId()); // << 이벤트 ID 기록
  sheet.getRange(row, 18).setValue('등록완료'); // << 상태 업데이트
}

function getColorId(team) {
  // << 팀별 색상 ID 반환
  switch (team) {
    case '생산팀':
      return '9'; // << 파란색
    case '품질팀':
      return '11'; // << 빨간색
    case '영업팀':
      return '10'; // << 초록색
    case '마케팅팀':
      return '5'; // << 노란색
    case '물류팀':
      return '3'; // << 보라색
    default:
      return '8'; // << 기본 회색
  }
}

/********* PDF 생성 및 알림 *********/ // << PDF 생성 및 Drive 업로드
function exportPdfAndNotify(row) {
  // << PDF 생성 후 폴더에 저장
  const lock = LockService.getScriptLock();
  lock.waitLock(30000); // << 동시 실행 방지
  try {
    const owner = data().getRange(row, 2).getDisplayValue().trim(); // << 신청자 이름
    const sheet = ss.getSheetByName(owner); // << 개인 시트
    if (!sheet) throw new Error('개인 시트를 찾을 수 없습니다: ' + owner); // << 예외 처리

    const baseUrl = ss.getUrl().replace(/\/edit$/, ''); // << 기본 URL
    const gid = sheet.getSheetId(); // << 시트 ID
    const pdfUrl =
      baseUrl +
      '/export?format=pdf' + // << PDF export URL 시작
      '&gid=' +
      gid +
      '&size=A4' +
      '&portrait=true' +
      '&scale=5' + // << 확대 배율
      '&spct=1.15' + // << 인쇄 비율
      '&gridlines=false' +
      '&sheetnames=false' +
      '&printtitle=false' +
      '&top_margin=1.2' + // << 상단 여백
      '&bottom_margin=1.2' + // << 하단 여백
      '&left_margin=0.7' + // << 좌측 여백
      '&right_margin=0.7'; // << 우측 여백
    const blob = UrlFetchApp.fetch(pdfUrl, {
      headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
    }).getBlob(); // << PDF Blob 가져오기

    const ts = data().getRange(row, 1).getValue(); // << 타임스탬프
    const formatted = Utilities.formatDate(
      new Date(ts),
      Session.getScriptTimeZone(),
      'yyyy-MM-dd_HH:mm:ss'
    ); // << 파일명 포맷

    const name = data().getRange(row, 2).getDisplayValue().trim(); // b열: 이름름
    const reason = data().getRange(row, 3).getDisplayValue().trim(); // C열: 휴가 사유 (공가, 연차 등)
    const start = data().getRange(row, 7).getDisplayValue().trim(); // G열: 시작일
    const end = data().getRange(row, 8).getDisplayValue().trim(); // H열: 종료일

    const fileName = `휴가신청서_${formatted}_${name}_${reason}_${start}~${end}까지.pdf`;

    blob.setName(fileName);
    DriveApp.getFolderById(CFG.PDF_FOLDER).createFile(blob); // << Drive 업로드

    // ④ PDF 생성에 성공한 경우에만 시트 삭제
    ss.deleteSheet(sheet); // << 방금 생성된 개인 시트 삭제
  } finally {
    lock.releaseLock(); // << 락 해제
  }
}

function testExportPdf40() {
  // << 테스트용 PDF 생성 함수
  exportPdfAndNotify(25); // << 25행 테스트
}

/**
 * 전자서명 웹앱에서 POST로 서명 이미지, row, role을 받으면 실행되는 함수
 */
function doPost(e) {
  Logger.log('[doPost] postData.contents: ' + e.postData.contents);
  try {
    var data = JSON.parse(e.postData.contents);
    Logger.log('[doPost] 받은 데이터:', data);
    var result = saveSignature(data.dataUrl, data.row, data.role);
    return ContentService.createTextOutput(JSON.stringify({ result: result, status: 'ok' }));
  } catch (err) {
    Logger.log('[doPost] 에러: ' + err + (err.stack ? '\n' + err.stack : ''));
    return ContentService.createTextOutput(
      JSON.stringify({ status: 'error', message: err.toString() })
    );
  }
}
