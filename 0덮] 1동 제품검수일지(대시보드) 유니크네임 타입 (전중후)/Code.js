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
    
    console.log(`[작업 중] 데이터: line="${line}", product="${product}", weight="${weight}", lot="${lot}"`);
    
    const expiry = Utilities.formatDate(
      new Date(expiryRaw),
      Session.getScriptTimeZone(),
      'yy.MM.dd'
    );
    const baseName = `${line}_${product}_${expiry}_${lot}_${weight}`.replace(
      /[/\\?%*:|"<>]/g,
      '-'
    ); // 기본 시트명 조합
    
    console.log(`[작업 중] baseName="${baseName}"`);

    // O열이 비어있거나 해당 시트명이 존재하지 않으면 fallback 실행
    if (!sheetName || !ss.getSheetByName(sheetName)) {
      console.log(`[작업 중] fallback 실행: sheetName="${sheetName}" 존재여부=${!!ss.getSheetByName(sheetName)}`);
      
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
    const baseName = `${line}_${product}_${expiry}_${lot}_${weight}`.replace(
      /[/\\?%*:|"<>]/g,
      '-'
    ); // 기본 시트명 조합

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
    const sheetUrl = ss.getUrl().replace(/\/edit.*$/, '') + `/edit?gid=${sh.getSheetId()}`; // ▶ URL 재계산
    data()
      .getRange(row, CFG.COL.CEO)
      .setFormula(`=IFERROR(VLOOKUP(F${row}, '${CFG.LOOKUP}'!B:H, 5, FALSE),"")`); // 팀장 이름 매핑
    SpreadsheetApp.flush();
    const leader = data().getRange(row, CFG.COL.CEO).getDisplayValue().trim(); // 매핑된 팀장
    if (leader) {
      const info = lookupBoardByName(leader); // 보드 ID 조회
      if (info) pushToBoard(info.boardId, 'leader', row, sheetUrl); // 보드 전송
    }
    return;
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
  const ts = new Date(); // A열 << 타임스탬프
  const docName = '1동 제품검수일지(대시보드)'; // B열  << 문서명       @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
  const vals = [
    ts,
    docName,
    data().getRange(srcRow, 6).getValue(), // C열
    data().getRange(srcRow, 15).getValue(),
  ]; // D열
  sh.getRange(dstRow, 1, 1, 4).setValues([vals]).setNumberFormat('yyyy/MM/dd HH:mm:ss'); // << 쓰기 및 서식 적용

  // 2) 원본 행 번호 및 개인 시트 URL
  sh.getRange(dstRow, 11).setValue(srcRow); // << 원본 행 기록
  if (url) sh.getRange(dstRow, 15).setValue(url); // << 개인 시트 링크 기록

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

/********* PDF 생성 및 알림 *********/ // << PDF 생성 및 Drive 업로드
function exportPdfAndNotify(row) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000); // << 동시 실행 방지

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
      lock.releaseLock();
      throw new Error('시트가 없습니다: ' + baseName);
    }
    sheetName = shLatest.getName(); // ▶ fallback된 시트명
    data().getRange(row, 15).setValue(sheetName); // 💡 fallback으로 찾은 시트 이름 O열에 기록
    console.log(`[PDF생성] O열 업데이트: ${sheetName}, row=${row}`);
  }

  const sheet = ss.getSheetByName(sheetName); // ▶ 최종 sheetName으로 조회
  if (!sheet) {
    console.log(`[PDF생성] 시트가 존재하지 않음: ${sheetName}, row=${row}`);
    lock.releaseLock();
    throw new Error('시트를 찾을 수 없습니다: ' + sheetName);
  }

  try {
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

    // ③ 파일명 설정 및 Drive 업로드
    const ts = data().getRange(row, 1).getValue(); // << A열: 타임스탬프
    const formatted = Utilities.formatDate(
      new Date(ts),
      Session.getScriptTimeZone(),
      'yyyy-MM-dd_HH:mm:ss'
    );
    blob.setName(`1동 제품검수일지(대시보드)_${formatted}_${sheetName}.pdf`); // << sheetName 기준 파일명 설정
    DriveApp.getFolderById(CFG.PDF_FOLDER).createFile(blob); // << PDF를 지정 폴더에 저장

    // ④ PDF 생성에 성공한 경우에만 시트 삭제
    ss.deleteSheet(sheet); // << 방금 생성된 개인 시트 삭제
  } finally {
    lock.releaseLock(); // << 락 해제 (항상 실행)
  }
}

function testExportPdf40() {
  // << 테스트용 PDF 생성 함수
  exportPdfAndNotify(24); // << 25행 테스트
}
