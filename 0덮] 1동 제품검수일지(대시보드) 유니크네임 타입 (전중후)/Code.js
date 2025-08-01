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
    CEO: 17, // << 팀장 컬럼 인덱스                                @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
    CEO_SIG: 18, // << 팀장 서명 컬럼 인덱스                             @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
  },
  BOARD_ID: {
    // << 보드 ID 매핑
    manager: '1bZD1_-sf-DqFDlxdc_PHxMD2hiqpglP_nP1zZkg54M4', // << 관리자 보드 ID   @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
  },
  PDF_FOLDER: '1iwIgwJCc2t2-LSK-eIFnXOFL2ntFaiaJ', // << PDF 저장 폴더 ID           @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
}; // << CFG 객체 끝

const ss = SpreadsheetApp.getActive(); // << 현재 활성 스프레드시트 참조
const data = () => ss.getSheetByName(CFG.DATA); // << 데이터 시트 가져오는 함수
const tpl = () => ss.getSheetByName(CFG.TEMPLATE); // << 템플릿 시트 가져오는 함수
const out = msg => ContentService.createTextOutput(msg); // << 웹앱 응답 함수

// 스프레드시트에 로그 기록하는 함수
function logToSheet(message) {
  try {
    let logSheet = ss.getSheetByName('로그');
    if (!logSheet) {
      logSheet = ss.insertSheet('로그');
      logSheet.getRange('A1:B1').setValues([['시간', '메시지']]);
    }
    const timestamp = new Date();
    logSheet.appendRow([timestamp, message]);
  } catch (error) {
    console.log(`로그 기록 실패: ${error.message}`);
  }
}

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
  const status = data().getRange(row, 2).getValue().toString().trim(); // B열: 상태

  if (status === '작업 시작 시') {
    const line = data().getRange(row, 12).getValue().toString().trim(); // L열: 주문자
    const product = data().getRange(row, 3).getValue().toString().trim(); // C열: 제품명
    const weightVal = data().getRange(row, 5).getValue().toString().trim(); // E열: 숫자 중량
    const weight = `${weightVal}g`; // g 고정
    const lot = data().getRange(row, 9).getValue().toString().trim(); // I열: 로트
    const expiryRaw = data().getRange(row, 8).getValue(); // O열: 유통기한 (Date 객체)
    const expiry = Utilities.formatDate(
      new Date(expiryRaw),
      Session.getScriptTimeZone(),
      'yy.MM.dd'
    );
    const baseName = `${line}_${product}_${expiry}_${lot}_${weight}`.replace(/[/\\?%*:|"<>]/g, '-'); // 기본 시트명 조합

    let uniqueName = baseName,
      i = 1; // 첫 시도는 baseName
    while (ss.getSheetByName(uniqueName)) {
      // 중복 시
      uniqueName = `${baseName}(${i++})`; // “baseName(1)”, “(2)”…
    }

    const s = tpl().copyTo(ss).setName(uniqueName); // 유니크 이름으로 시트 생성
    s.getRange('M10').setValue(data().getRange(row, 1).getValue()); // M10에 타임스탬프 기록
    data().getRange(row, 15).setValue(uniqueName); // ▶ O열(15)에 uniqueName 저장
    return; // 이후 로직 스킵
  } else if (status === '작업 중') {
    console.log(`[작업 중 시작] row=${row}`);

    // O열에 기록된 uniqueName 우선, 없으면 가장 최근 생성된 시트로 폴백
    let sheetName = data().getRange(row, 15).getDisplayValue().trim(); // ▶ O열에서 uniqueName 읽기
    console.log(`[작업 중] 기존 O열 값: "${sheetName}"`);

    // 항상 baseName을 생성하여 시트 존재 여부 확인
    const line = data().getRange(row, 12).getValue().toString().trim(); // L열: 주문자
    const product = data().getRange(row, 3).getValue().toString().trim(); // C열: 제품명
    const weightVal = data().getRange(row, 5).getValue().toString().trim(); // E열: 숫자 중량
    const weight = `${weightVal}g`; // g 고정
    const lot = data().getRange(row, 9).getValue().toString().trim(); // I열: 로트
    const expiryRaw = data().getRange(row, 8).getValue(); // H열: 유통기한 (Date 객체)

    console.log(
      `[작업 중] 데이터: line="${line}", product="${product}", weight="${weight}", lot="${lot}"`
    );

    const expiry = Utilities.formatDate(
      new Date(expiryRaw),
      Session.getScriptTimeZone(),
      'yy.MM.dd'
    );
    const baseName = `${line}_${product}_${expiry}_${lot}_${weight}`.replace(/[/\\?%*:|"<>]/g, '-'); // 기본 시트명 조합

    console.log(`[작업 중] baseName="${baseName}"`);

    // O열이 비어있거나 해당 시트명이 존재하지 않으면 fallback 실행
    if (!sheetName || !ss.getSheetByName(sheetName)) {
      console.log(
        `[작업 중] fallback 실행: sheetName="${sheetName}" 존재여부=${!!ss.getSheetByName(
          sheetName
        )}`
      );

      const shLatest = getLatestSheet(baseName); // 최근 시트 객체
      if (!shLatest) {
        console.log(`[작업 중] 시트를 찾을 수 없음: baseName=${baseName}, row=${row}`);
        return; // 없다면 종료
      }
      sheetName = shLatest.getName(); // 이름으로 갱신
      console.log(`[작업 중] 찾은 시트명: "${sheetName}"`);

      data().getRange(row, 15).setValue(sheetName); // 💡 fallback으로 찾은 시트 이름 O열에 기록
      console.log(`[작업 중] O열 업데이트 완료: ${sheetName}, row=${row}`);
    }

    const sh = ss.getSheetByName(sheetName); // ▶ 정확히 해당 시트만 조회
    if (!sh) {
      console.log(`[작업 중] 시트가 존재하지 않음: ${sheetName}, row=${row}`);
      return; // 없으면 종료
    }

    console.log(`[작업 중] 시트 찾음: "${sheetName}"`);

    const mVals = sh.getRange('M10:M').getValues().flat(); // M10 이하 값
    const nextRow = 10 + mVals.filter(v => v !== '').length; // 다음 빈 M행 계산
    console.log(`[작업 중] M열 다음 행: ${nextRow}`);

    sh.getRange(`M${nextRow}`).setValue(data().getRange(row, 1).getValue()); // ▶ 타임스탬프 기록
    console.log(`[작업 중] M${nextRow}에 타임스탬프 기록 완료`);
    return;
  } else if (status === '제품생산 완료') {
    // O열에 기록된 uniqueName 우선, 없으면 가장 최근 생성된 시트로 폴백
    let sheetName = data().getRange(row, 15).getDisplayValue().trim(); // ▶ O열에서 uniqueName 읽기

    // 항상 baseName을 생성하여 시트 존재 여부 확인
    const line = data().getRange(row, 12).getValue().toString().trim(); // L열: 주문자
    const product = data().getRange(row, 3).getValue().toString().trim(); // C열: 제품명
    const weightVal = data().getRange(row, 5).getValue().toString().trim(); // E열: 숫자 중량
    const weight = `${weightVal}g`; // g 고정
    const lot = data().getRange(row, 9).getValue().toString().trim(); // I열: 로트
    const expiryRaw = data().getRange(row, 8).getValue(); // H열: 유통기한 (Date 객체)
    const expiry = Utilities.formatDate(
      new Date(expiryRaw),
      Session.getScriptTimeZone(),
      'yy.MM.dd'
    );
    const baseName = `${line}_${product}_${expiry}_${lot}_${weight}`.replace(/[/\\?%*:|"<>]/g, '-'); // 기본 시트명 조합

    // O열이 비어있거나 해당 시트명이 존재하지 않으면 fallback 실행
    if (!sheetName || !ss.getSheetByName(sheetName)) {
      const shLatest = getLatestSheet(baseName); // 최근 시트 객체
      if (!shLatest) {
        console.log(`[제품생산 완료] 시트를 찾을 수 없음: baseName=${baseName}, row=${row}`);
        return;
      }
      sheetName = shLatest.getName();
      data().getRange(row, 15).setValue(sheetName); // 💡 fallback으로 찾은 시트 이름 O열에 기록
      console.log(`[제품생산 완료] O열 업데이트: ${sheetName}, row=${row}`);
    }

    const sh = ss.getSheetByName(sheetName); // ▶ 정확히 해당 시트만 조회
    if (!sh) {
      console.log(`[제품생산 완료] 시트가 존재하지 않음: ${sheetName}, row=${row}`);
      return;
    }

    const mVals = sh.getRange('M10:M').getValues().flat(); // M10 이하 값
    const nextRow = 10 + mVals.filter(v => v !== '').length; // 다음 빈 M행 계산
    sh.getRange(`M${nextRow}`).setValue(data().getRange(row, 1).getValue()); // ▶ 타임스탬프 기록

    // (이후 팀장 보드 전송 로직)
    data()
      .getRange(row, CFG.COL.CEO)
      .setFormula(`=IFERROR(VLOOKUP(F${row}, '${CFG.LOOKUP}'!B:H, 5, FALSE),"")`); // 팀장 이름 매핑
    SpreadsheetApp.flush();
    const leader = data().getRange(row, CFG.COL.CEO).getDisplayValue().trim(); // 매핑된 팀장
    if (leader) {
      const info = lookupBoardByName(leader); // 보드 ID 조회
      if (info) pushToBoard(info.boardId, 'leader', row); // 보드 전송 (URL 제거)
    }
    return;
  }
}

/********** 2) 웹앱 진입점 – doGet **********/
function doGet(e) {
  console.log(`[doGet] 함수 호출됨 - 파라미터: ${JSON.stringify(e.parameter)}`);
  logToSheet(`[doGet] 함수 호출됨 - 파라미터: ${JSON.stringify(e.parameter)}`);

  const role = e.parameter.role;
  const row = parseInt(e.parameter.row, 10);

  console.log(`[doGet] 파라미터 파싱 - role: ${role}, row: ${row}`);
  logToSheet(`[doGet] 파라미터 파싱 - role: ${role}, row: ${row}`);

  if (!role || !row) {
    console.log(`[doGet] 파라미터 오류 - role: ${role}, row: ${row}`);
    logToSheet(`[doGet] 파라미터 오류 - role: ${role}, row: ${row}`);
    return out('param err');
  }

  console.log(`[doGet] 유효한 파라미터 확인됨`);
  logToSheet(`[doGet] 유효한 파라미터 확인됨`);

  if (role === 'leader') {
    console.log(`[doGet] 팀장 서명 처리 시작`);
    logToSheet(`[doGet] 팀장 서명 처리 시작`);

    const leaderName = data().getRange(row, CFG.COL.CEO).getDisplayValue().trim();
    console.log(`[doGet] 팀장 이름: ${leaderName}`);
    logToSheet(`[doGet] 팀장 이름: ${leaderName}`);

    insertSig(row, CFG.COL.CEO_SIG, leaderName);
    SpreadsheetApp.flush();
    console.log(`[doGet] 서명 삽입 완료`);
    logToSheet(`[doGet] 서명 삽입 완료`);

    // PDF 생성 (기존 파일 휴지통 이동 후 새 파일 생성)
    console.log(`[doGet] PDF 생성 시작`);
    logToSheet(`[doGet] PDF 생성 시작`);
    exportPdfAndNotify(row);
    console.log(`[doGet] PDF 생성 완료`);
    logToSheet(`[doGet] PDF 생성 완료`);

    console.log(`[doGet] 모든 처리 완료`);
    logToSheet(`[doGet] 모든 처리 완료`);
  } else {
    console.log(`[doGet] 지원하지 않는 role: ${role}`);
    logToSheet(`[doGet] 지원하지 않는 role: ${role}`);
  }

  console.log(`[doGet] 함수 종료`);
  logToSheet(`[doGet] 함수 종료`);
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
function pushToBoard(boardId, role, srcRow) {
  // << 보드에 항목 추가
  const masterId = ss.getId(); // << 마스터 스프레드시트 ID
  const sh = SpreadsheetApp.openById(boardId).getSheets()[0]; // << 보드 시트
  const dstRow = sh.getLastRow() + 1; // << 추가할 행번호

  // PDF 생성하고 파일 ID 획득
  const pdfFileId = createPdfFromSheet(srcRow, false); // << 첫 번째 PDF 생성
  console.log(`[pushToBoard] PDF 생성 완료, 파일 ID: ${pdfFileId}`);

  // 1) A~G 값 쓰기
  const ts = new Date(); // A열 << 타임스탬프
  const docName = '1동 제품검수일지(대시보드)'; // B열  << 문서명       @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
  const vals = [
    ts,
    docName,
    data().getRange(srcRow, 6).getValue(), // C열
    data().getRange(srcRow, 15).getValue(),
  ]; // D열
  sh.getRange(dstRow, 1, 1, 4).setValues([vals]).setNumberFormat('yyyy/MM/dd HH:mm:ss'); // << 쓰기 및 서식 적용

  // 2) 원본 행 번호 및 PDF 파일 ID
  sh.getRange(dstRow, 11).setValue(srcRow); // << 원본 행 기록
  sh.getRange(dstRow, 15).setValue(pdfFileId); // << PDF 파일 ID 기록

  // 3) IMPORTRANGE 설정
  const imp = c => `=IMPORTRANGE("${masterId}","A시트!${c}${srcRow}")`; // << IMPORTRANGE 수식
  sh.getRange(dstRow, 8).setFormula(imp('r')); // << 서명자                                @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
  // sh.getRange(dstRow,9).setFormula(imp('r')); // << 다음 서명자                          @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
  // sh.getRange(dstRow,10).setFormula(imp('')); // << 최종 서명자                         @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@

  // 4) 체크박스
  sh.getRange(dstRow, 12).insertCheckboxes(); // << 체크박스 삽입

  // 5) 서명 하이퍼링크
  const execUrl = lookupExecUrlByScriptId(ScriptApp.getScriptId()); // << 실행 URL 조회
  sh.getRange(dstRow, 13).setFormula(`=HYPERLINK("${execUrl}?role=${role}&row=${srcRow}","")`); // << 서명 버튼 링크
}

/********* PDF 생성 함수 *********/ // << PDF 생성 및 Drive 업로드 (파일 ID 반환)
function createPdfFromSheet(row, moveOldToTrash = false) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000); // << 동시 실행 방지

  try {
    // ① O열(15)에 저장된 uniqueName 우선, 없으면 baseName으로 폴백하여 최신 시트 찾기
    let sheetName = data().getRange(row, 15).getDisplayValue().trim(); // ▶ O열에서 uniqueName 읽기

    // 항상 baseName을 생성하여 시트 존재 여부 확인
    const line = data().getRange(row, 12).getValue().toString().trim(); // L열: 주문자
    const product = data().getRange(row, 3).getValue().toString().trim(); // C열: 제품명
    const weightVal = data().getRange(row, 5).getValue().toString().trim(); // E열: 숫자 중량
    const weight = `${weightVal}g`; // g 고정
    const lot = data().getRange(row, 9).getValue().toString().trim(); // I열: 로트
    const expiryRaw = data().getRange(row, 8).getValue(); // H열: 유통기한 (Date 객체)
    const expiry = Utilities.formatDate(
      new Date(expiryRaw),
      Session.getScriptTimeZone(),
      'yy.MM.dd'
    );
    const baseName = `${line}_${product}_${expiry}_${lot}_${weight}`.replace(/[/\\?%*:|"<>]/g, '-'); // 기본 시트명 조합

    // O열이 비어있거나 해당 시트명이 존재하지 않으면 fallback 실행
    if (!sheetName || !ss.getSheetByName(sheetName)) {
      const shLatest = getLatestSheet(baseName); // ▶ 가장 최근(n 최대) 시트 객체
      if (!shLatest) {
        console.log(`[PDF생성] 시트를 찾을 수 없음: baseName=${baseName}, row=${row}`);
        throw new Error('시트가 없습니다: ' + baseName);
      }
      sheetName = shLatest.getName(); // ▶ fallback된 시트명
      data().getRange(row, 15).setValue(sheetName); // 💡 fallback으로 찾은 시트 이름 O열에 기록
      console.log(`[PDF생성] O열 업데이트: ${sheetName}, row=${row}`);
    }

    const sheet = ss.getSheetByName(sheetName); // ▶ 최종 sheetName으로 조회
    if (!sheet) {
      console.log(`[PDF생성] 시트가 존재하지 않음: ${sheetName}, row=${row}`);
      throw new Error('시트를 찾을 수 없습니다: ' + sheetName);
    }

    // ② PDF URL 구성 및 Blob 생성
    const baseUrl = ss.getUrl().replace(/\/edit$/, ''); // << 스프레드시트 기본 URL
    const gid = sheet.getSheetId(); // << 대상 시트 GID
    const pdfUrl =
      baseUrl +
      '/export?format=pdf' +
      `&gid=${gid}` + // << 해당 탭 지정
      '&size=A4&portrait=true&scale=4' + // << 용지/축척 설정
      '&top_margin=0.2&bottom_margin=0.2&left_margin=0.2&right_margin=0.2' + // << 여백 설정
      '&gridlines=false&sheetnames=false&printtitle=false' + // << 인쇄 옵션
      '&horizontal_alignment=CENTER&vertical_alignment=MIDDLE' +
      '&r1=0&r2=15&c1=0&c2=9'; // << 인쇄 범위

    const blob = UrlFetchApp.fetch(pdfUrl, {
      headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }, // << OAuth 토큰 사용
    }).getBlob(); // << PDF Blob 생성

    // ③ 파일명 설정
    const ts = data().getRange(row, 1).getValue(); // << A열: 타임스탬프
    const formatted = Utilities.formatDate(
      new Date(ts),
      Session.getScriptTimeZone(),
      'yyyy-MM-dd_HH:mm:ss'
    );
    const fileName = `1동 제품검수일지(대시보드)_${formatted}_${sheetName}.pdf`;
    blob.setName(fileName);

    // 디버깅: 파일명 로그 출력
    console.log(`[PDF생성] 생성할 파일명: ${fileName}`);
    console.log(`[PDF생성] 타임스탬프: ${ts}`);
    console.log(`[PDF생성] 시트명: ${sheetName}`);

    const folder = DriveApp.getFolderById(CFG.PDF_FOLDER);

    // ④ 기존 파일 휴지통 이동 (서명 완료 시)
    if (moveOldToTrash) {
      console.log(`[PDF생성] 기존 파일 휴지통 이동 중: ${fileName}`);
      logToSheet(`[PDF생성] 기존 파일 휴지통 이동 중: ${fileName}`);

      // 폴더 접근 권한 확인
      try {
        const folderName = folder.getName();
        console.log(`[PDF생성] 폴더 접근 성공: ${folderName}`);
        logToSheet(`[PDF생성] 폴더 접근 성공: ${folderName}`);
      } catch (error) {
        console.log(`[PDF생성] 폴더 접근 실패: ${error.message}`);
        logToSheet(`[PDF생성] 폴더 접근 실패: ${error.message}`);
        return;
      }

      // 정확한 파일명 패턴으로 검색
      const filePrefix = '1동 제품검수일지(대시보드)_';
      const fileSuffix = `.pdf`;
      const searchPattern = `${filePrefix}*_${sheetName}${fileSuffix}`;
      console.log(`[PDF생성] 검색 패턴: ${searchPattern}`);
      logToSheet(`[PDF생성] 검색 패턴: ${searchPattern}`);

      const allFiles = folder.getFiles();
      let totalFiles = 0;
      let trashCount = 0;
      const foundFiles = [];

      // 폴더 내 모든 파일 목록 출력
      while (allFiles.hasNext()) {
        const file = allFiles.next();
        const currentFileName = file.getName();
        totalFiles++;
        console.log(`[PDF생성] 폴더 내 파일 ${totalFiles}: ${currentFileName}`);

        // 정확한 패턴 매칭: 시작 부분 + 시트명 + .pdf
        if (
          currentFileName.startsWith(filePrefix) &&
          currentFileName.includes(`_${sheetName}${fileSuffix}`)
        ) {
          trashCount++;
          foundFiles.push({ name: currentFileName, id: file.getId() });
          console.log(`[PDF생성] 매칭 파일 ${trashCount} 발견: ${currentFileName}`);
          logToSheet(`[PDF생성] 매칭 파일 ${trashCount} 발견: ${currentFileName}`);
        }
      }

      console.log(`[PDF생성] 폴더 내 총 ${totalFiles}개 파일, 매칭 파일 ${trashCount}개`);
      logToSheet(`[PDF생성] 폴더 내 총 ${totalFiles}개 파일, 매칭 파일 ${trashCount}개`);

      // 발견된 파일들을 휴지통으로 이동
      for (let i = 0; i < foundFiles.length; i++) {
        const fileInfo = foundFiles[i];
        try {
          const file = DriveApp.getFileById(fileInfo.id);
          file.setTrashed(true);
          console.log(`[PDF생성] 파일 휴지통 이동 성공: ${fileInfo.name} (ID: ${fileInfo.id})`);
          logToSheet(`[PDF생성] 파일 휴지통 이동 성공: ${fileInfo.name}`);
        } catch (error) {
          console.log(`[PDF생성] 파일 휴지통 이동 실패: ${fileInfo.name} - ${error.message}`);
          logToSheet(`[PDF생성] 파일 휴지통 이동 실패: ${fileInfo.name} - ${error.message}`);
        }
      }

      console.log(`[PDF생성] 휴지통 이동 완료 - 총 ${trashCount}개 파일 처리`);
      logToSheet(`[PDF생성] 휴지통 이동 완료 - 총 ${trashCount}개 파일 처리`);
    }

    // ⑤ 새 PDF 파일 생성
    const pdfFile = folder.createFile(blob);
    console.log(`[PDF생성] 파일 생성 완료: ${fileName}, ID: ${pdfFile.getId()}`);

    return pdfFile.getId(); // << PDF 파일 ID 반환
  } finally {
    lock.releaseLock(); // << 락 해제 (항상 실행)
  }
}

/********* 기존 PDF 휴지통 이동 함수 *********/
function moveExistingPdfToTrash(row) {
  console.log(`[휴지통이동] 시작 - row: ${row}`);

  // 파일명 생성
  const line = data().getRange(row, 12).getValue().toString().trim();
  const product = data().getRange(row, 3).getValue().toString().trim();
  const weightVal = data().getRange(row, 5).getValue().toString().trim();
  const weight = `${weightVal}g`;
  const lot = data().getRange(row, 9).getValue().toString().trim();
  const expiryRaw = data().getRange(row, 8).getValue();
  const expiry = Utilities.formatDate(new Date(expiryRaw), Session.getScriptTimeZone(), 'yy.MM.dd');

  const ts = data().getRange(row, 1).getValue();
  const formatted = Utilities.formatDate(
    new Date(ts),
    Session.getScriptTimeZone(),
    'yyyy-MM-dd_HH:mm:ss'
  );

  const sheetName = data().getRange(row, 15).getDisplayValue().trim();
  const fileName = `1동 제품검수일지(대시보드)_${formatted}_${sheetName}.pdf`;

  console.log(`[휴지통이동] 파일명: ${fileName}`);

  const folder = DriveApp.getFolderById(CFG.PDF_FOLDER);
  const existingFiles = folder.getFilesByName(fileName);
  let trashCount = 0;

  while (existingFiles.hasNext()) {
    const file = existingFiles.next();
    trashCount++;
    console.log(`[휴지통이동] 파일 ${trashCount} 발견 - ID: ${file.getId()}`);

    try {
      file.setTrashed(true);
      console.log(`[휴지통이동] 파일 ${trashCount} 휴지통 이동 성공!`);
    } catch (error) {
      console.log(`[휴지통이동] 파일 ${trashCount} 휴지통 이동 실패: ${error.message}`);
    }
  }

  console.log(`[휴지통이동] 완료 - 총 ${trashCount}개 파일 처리`);
}

/********* 서명 완료 후 PDF 생성 및 시트 삭제 *********/ // << 최종 서명 후 처리
function exportPdfAndNotify(row) {
  console.log(`[exportPdfAndNotify] 시작 - row: ${row}`);
  logToSheet(`[exportPdfAndNotify] 시작 - row: ${row}`);

  try {
    // PDF 생성 (기존 파일 휴지통 이동 후 새 파일 생성)
    console.log(`[exportPdfAndNotify] PDF 생성 시작`);
    logToSheet(`[exportPdfAndNotify] PDF 생성 시작`);
    createPdfFromSheet(row, true);
    console.log(`[exportPdfAndNotify] PDF 생성 완료`);
    logToSheet(`[exportPdfAndNotify] PDF 생성 완료`);

    // 시트 삭제
    console.log(`[exportPdfAndNotify] 시트 삭제 시작`);
    logToSheet(`[exportPdfAndNotify] 시트 삭제 시작`);
    let sheetName = data().getRange(row, 15).getDisplayValue().trim();
    console.log(`[exportPdfAndNotify] 삭제할 시트명: ${sheetName}`);
    logToSheet(`[exportPdfAndNotify] 삭제할 시트명: ${sheetName}`);

    const sheet = ss.getSheetByName(sheetName);
    if (sheet) {
      ss.deleteSheet(sheet);
      console.log(`[exportPdfAndNotify] 시트 삭제 완료: ${sheetName}`);
      logToSheet(`[exportPdfAndNotify] 시트 삭제 완료: ${sheetName}`);
    } else {
      console.log(`[exportPdfAndNotify] 삭제할 시트가 없음: ${sheetName}`);
      logToSheet(`[exportPdfAndNotify] 삭제할 시트가 없음: ${sheetName}`);
    }
  } catch (error) {
    console.log(`[exportPdfAndNotify] 오류 발생: ${error.message}`);
    logToSheet(`[exportPdfAndNotify] 오류 발생: ${error.message}`);
    throw error;
  }

  console.log(`[exportPdfAndNotify] 완료`);
  logToSheet(`[exportPdfAndNotify] 완료`);
}

function testExportPdf40() {
  // << 테스트용 PDF 생성 함수
  exportPdfAndNotify(24); // << 25행 테스트
}

/********* PDF 파일 관리 테스트 함수들 *********/
function testPdfDelete() {
  // PDF 완전 삭제 테스트
  const fileName =
    '1동 제품검수일지(대시보드)_2025-08-01_15:53:52_1라인_미쓰리 떡볶이소스 순한맛_25.08.01_12_12g.pdf';
  const folder = DriveApp.getFolderById(CFG.PDF_FOLDER);

  console.log(`[삭제테스트] 파일 찾는 중: ${fileName}`);
  const files = folder.getFilesByName(fileName);
  let count = 0;

  while (files.hasNext()) {
    const file = files.next();
    count++;
    console.log(`[삭제테스트] 파일 ${count} 발견 - ID: ${file.getId()}`);

    try {
      DriveApp.removeFile(file);
      console.log(`[삭제테스트] 완전 삭제 성공!`);
    } catch (error) {
      console.log(`[삭제테스트] 삭제 실패: ${error.message}`);
    }
  }

  console.log(`[삭제테스트] 처리 완료 - 총 ${count}개 파일`);
}

function testPdfTrash() {
  // PDF 휴지통 이동 테스트
  const fileName =
    '1동 제품검수일지(대시보드)_2025-08-01_15:53:52_1라인_미쓰리 떡볶이소스 순한맛_25.08.01_12_12g.pdf';
  const folder = DriveApp.getFolderById(CFG.PDF_FOLDER);

  console.log(`[휴지통테스트] 파일 찾는 중: ${fileName}`);
  const files = folder.getFilesByName(fileName);
  let count = 0;

  while (files.hasNext()) {
    const file = files.next();
    count++;
    console.log(`[휴지통테스트] 파일 ${count} 발견 - ID: ${file.getId()}`);

    try {
      file.setTrashed(true);
      console.log(`[휴지통테스트] 휴지통 이동 성공!`);
    } catch (error) {
      console.log(`[휴지통테스트] 휴지통 이동 실패: ${error.message}`);
    }
  }

  console.log(`[휴지통테스트] 처리 완료 - 총 ${count}개 파일`);
}

function testPdfOverwrite() {
  // PDF 덮어쓰기 테스트 (기존 파일 삭제 후 새로 생성)
  const fileName =
    '1동 제품검수일지(대시보드)_2025-08-01_15:53:52_1라인_미쓰리 떡볶이소스 순한맛_25.08.01_12_12g.pdf';
  const folder = DriveApp.getFolderById(CFG.PDF_FOLDER);

  console.log(`[덮어쓰기테스트] 기존 파일 찾는 중: ${fileName}`);
  const files = folder.getFilesByName(fileName);
  let count = 0;

  // 1단계: 기존 파일 삭제
  while (files.hasNext()) {
    const file = files.next();
    count++;
    console.log(`[덮어쓰기테스트] 기존 파일 ${count} 발견 - ID: ${file.getId()}`);

    try {
      DriveApp.removeFile(file);
      console.log(`[덮어쓰기테스트] 기존 파일 삭제 성공!`);
    } catch (error) {
      console.log(`[덮어쓰기테스트] 기존 파일 삭제 실패: ${error.message}`);
    }
  }

  // 2단계: 새 파일 생성 (테스트용 더미 내용)
  try {
    const blob = Utilities.newBlob('테스트 PDF 내용', 'application/pdf', fileName);
    const newFile = folder.createFile(blob);
    console.log(`[덮어쓰기테스트] 새 파일 생성 성공! ID: ${newFile.getId()}`);
  } catch (error) {
    console.log(`[덮어쓰기테스트] 새 파일 생성 실패: ${error.message}`);
  }

  console.log(`[덮어쓰기테스트] 처리 완료 - 기존 ${count}개 파일 처리`);
}

function testMoveToTrash472() {
  // 472행 기준으로 휴지통 이동 테스트
  console.log('=== 휴지통 이동 테스트 시작 ===');
  moveExistingPdfToTrash(472);
  console.log('=== 휴지통 이동 테스트 완료 ===');
}

function testLogToSheet() {
  // 로그 함수 테스트
  console.log('=== 로그 테스트 시작 ===');
  logToSheet('테스트 로그 메시지');
  logToSheet('로그 함수가 잘 작동하는지 확인');
  console.log('=== 로그 테스트 완료 ===');
}
