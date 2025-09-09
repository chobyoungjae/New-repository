/**************** CONFIG ****************/ // << 설정 섹션 시작
const CFG = {
  // << 전역 설정 객체 선언
  DATA: 'A시트', // << 메인 데이터 시트 이름
  TEMPLATE: '문서', // << 개인 템플릿 시트 이름
  LOOKUP: 'B시트', // << 이름→대시보드ID 매핑 시트 이름
  MAP_ID: '문서ID', // << 스프레드시트ID→스크립트ID→URL 매핑 시트 이름
  HEADERS: {
    // << 헤더명 기반 매핑
    WRITER: '작성자',
    APPROVER: '승인자', 
    WRITER_SIGNATURE: '작성자서명',
    APPROVER_SIGNATURE: '승인자서명',
    UNIQUE_NAME: '유니크네임',
    PRODUCT_NAME: '제품명',
    PRODUCTION_LINE: '생산라인',
    LOT: '로트번호',
    WEIGHT: '중량',
    // 이미지 관련 헤더명
    EXPIRY_MANAGEMENT: '일부인 관리(소비기한)',
    LABEL_MANAGEMENT: '포장지 라벨 관리', 
    BOX_MANAGEMENT: '박스 소비기한 및 라벨 관리'
  },
  BOARD_ID: {
    // << 보드 ID 매핑
    manager: '1bZD1_-sf-DqFDlxdc_PHxMD2hiqpglP_nP1zZkg54M4', // << 관리자 보드 ID
  },
  PDF_FOLDER: '1b5pxfCTmNKiXf8lSYrr5HI2V6IQnKKD4', // << PDF 저장 폴더 ID
  WEB_APP_URL: '', // << 웹앱 URL (배포 후 여기에 입력하세요)
  DOC_NAME: '제품품질체크일지(대시보드)유니크네임+헤더명', // << 문서명 (매핑시트에서 사용)
}; // << CFG 객체 끝

/**************** GLOBAL REFERENCES ****************/ // << 전역 참조 섹션
const ss = SpreadsheetApp.getActive(); // << 현재 활성 스프레드시트 참조
const data = () => ss.getSheetByName(CFG.DATA); // << 데이터 시트 가져오는 함수
const tpl = () => ss.getSheetByName(CFG.TEMPLATE); // << 템플릿 시트 가져오는 함수

/**************** UTILITY FUNCTIONS ****************/ // << 유틸리티 함수 섹션
// ▶ Drive URL에서 파일 ID 추출
function extractId(url) {
  if (!url) return '';
  const m = url.toString().match(/[-\w]{25,}/);
  return m ? m[0] : '';
}

// ▶ 헤더명으로 컬럼 인덱스 찾기
function findColumnByHeader(headerName, sheetName = CFG.DATA) {
  const sheet = ss.getSheetByName(sheetName);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  
  for (let i = 0; i < headers.length; i++) {
    if (headers[i].toString().trim() === headerName.toString().trim()) {
      return i + 1; // 1-based index
    }
  }
  return null; // 헤더를 찾지 못한 경우
}

// ▶ 서명 관련 컬럼 인덱스를 헤더명으로 찾기
function getSignatureColumns() {
  return {
    writerSignature: findColumnByHeader('작성자서명'),    // AJ열
    approver: findColumnByHeader('승인자'),              // AK열  
    approverSignature: findColumnByHeader('승인자서명')   // AL열
  };
}

// ▶ 문서 시트의 B열 헤더명으로 A시트 데이터 매핑
function populateDocumentFromHeaders(docSheetName, sourceRow) {
  const docSheet = ss.getSheetByName(docSheetName);
  const dataSheet = data();
  
  // 문서 시트의 B열(B6:B35) 헤더명 읽기
  const headerRange = docSheet.getRange('B6:B35');
  const headers = headerRange.getValues().flat().filter(h => h.toString().trim() !== '');
  
  // A시트의 헤더행 읽기
  const dataHeaders = dataSheet.getRange(1, 1, 1, dataSheet.getLastColumn()).getValues()[0];
  
  // 각 헤더명에 대해 매핑
  headers.forEach((header, index) => {
    const headerStr = header.toString().trim();
    if (!headerStr) return;
    
    // A시트에서 해당 헤더의 컬럼 찾기
    const colIndex = dataHeaders.findIndex(h => h.toString().trim() === headerStr);
    
    if (colIndex !== -1) {
      // 찾은 경우 해당 데이터를 문서 시트 C열에 입력
      const value = dataSheet.getRange(sourceRow, colIndex + 1).getValue();
      docSheet.getRange(6 + index, 3).setValue(value); // C6부터 시작
    }
  });
}


/******** 1. 양식 제출 시 – 팀장 보드로 ********/ // << 폼 제출 트리거 부분 시작
function onFormSubmit(e) {
  // << 폼 제출 시 호출
  const row = e.range.getRow(); // << 제출된 행 번호
  let sheetUrl = ''; // << 개인 시트 URL 초기화

  // ▶ 헤더명으로 동적 컬럼 찾기
  const writerCol = findColumnByHeader(CFG.HEADERS.WRITER);
  const productCol = findColumnByHeader(CFG.HEADERS.PRODUCT_NAME);
  const lineCol = findColumnByHeader(CFG.HEADERS.PRODUCTION_LINE);
  const lotCol = findColumnByHeader(CFG.HEADERS.LOT);
  const weightCol = findColumnByHeader(CFG.HEADERS.WEIGHT);
  const uniqueNameCol = findColumnByHeader(CFG.HEADERS.UNIQUE_NAME);

  // ▶ 시트명용 데이터 추출 (헤더명 기반)
  const writer = writerCol ? data().getRange(row, writerCol).getValue().toString().trim() : '';
  const product = productCol ? data().getRange(row, productCol).getValue().toString().trim() : '';
  const line = lineCol ? data().getRange(row, lineCol).getValue().toString().trim() : '';
  const lot = lotCol ? data().getRange(row, lotCol).getValue().toString().trim() : '';
  const weightVal = weightCol ? data().getRange(row, weightCol).getValue().toString().trim() : '';
  const weight = weightVal ? `${weightVal}g` : '';
  
  // 타임스탬프에서 날짜 추출
  const timestamp = data().getRange(row, 1).getValue();
  const expiry = Utilities.formatDate(new Date(timestamp), Session.getScriptTimeZone(), 'yy.MM.dd');

  if (line && product && weight && lot) {
    // << 네 값 모두 있을 때만 실행
    // ▶ 기본 시트명 조합 + 불가문자 치환
    const baseName = `${line}_${product}_${expiry}_${lot}_${weight}`.replace(/[/\\?%*:|"<>]/g, '-'); // << “주문자_제품명_중량_로트” 형태

    // ▶ 중복 시 “(1)”, “(2)”… 붙여 유니크하게
    let uniqueName = baseName,
      i = 1; // << 기본 이름 + 카운터
    while (ss.getSheetByName(uniqueName)) {
      uniqueName = `${baseName}(${i++})`; // << 중복 발견 시 숫자 증가
    }

    // ▶ 템플릿 복사 + 이름 설정 + 타임스탬프 삽입
    const s = tpl().copyTo(ss).setName(uniqueName); // << 개인 시트 생성
    s.getRange('C3').setValue(data().getRange(row, 1).getValue()); // << C3에 타임스탬프 기록
    
    // ▶ 이미지 삽입 (AF, AG, AH열 → 32, 33, 34열)
    try {
      const afId = extractId(data().getRange(row, 32).getValue());
      if (afId) {
        const afBlob = UrlFetchApp.fetch(`https://drive.google.com/thumbnail?sz=w400&id=${afId}`, {
          headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
        }).getBlob();
        const afImg = s.insertImage(afBlob, 1, 48);
        afImg.setWidth(619).setHeight(271);
      }

      const agId = extractId(data().getRange(row, 33).getValue());
      if (agId) {
        const agBlob = UrlFetchApp.fetch(`https://drive.google.com/thumbnail?sz=w400&id=${agId}`, {
          headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
        }).getBlob();
        const agImg = s.insertImage(agBlob, 1, 62);
        agImg.setWidth(619).setHeight(271);
      }

      const ahId = extractId(data().getRange(row, 34).getValue());
      if (ahId) {
        const ahBlob = UrlFetchApp.fetch(`https://drive.google.com/thumbnail?sz=w400&id=${ahId}`, {
          headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
        }).getBlob();
        const ahImg = s.insertImage(ahBlob, 1, 76);
        ahImg.setWidth(619).setHeight(271);
      }
    } catch (err) {
      Logger.log('이미지 삽입 오류: ' + err);
    }
    
    // ▶ 유니크네임을 헤더명으로 찾은 컬럼에 저장
    if (uniqueNameCol) {
      data().getRange(row, uniqueNameCol).setValue(uniqueName);
    }
    
    // ▶ 헤더명 기반으로 문서 시트에 데이터 매핑
    populateDocumentFromHeaders(uniqueName, row);

    // ▶ 개인 시트 URL 생성 (필요 시 활용)
    sheetUrl = ss.getUrl().replace(/\/edit.*$/, '') + `/edit?gid=${s.getSheetId()}`; // << 개인 시트 링크
    // data().getRange(row, 15).setValue(sheetUrl);                     // << URL 저장은 생략 가능
  }

  // ▶ 승인자(팀장) 셋업 - 헤더명 기반
  const approverCol = findColumnByHeader(CFG.HEADERS.APPROVER);
  if (approverCol && writerCol) {
    const writerColLetter = String.fromCharCode(64 + writerCol); // 숫자를 알파벳으로 변환
    data()
      .getRange(row, approverCol)
      .setFormula(`=IFERROR(VLOOKUP(${writerColLetter}${row}, '${CFG.LOOKUP}'!B:H, 5, FALSE),"")`);
    SpreadsheetApp.flush(); // << 변경사항 강제 반영
  }

  // ▶ 보드로 전송
  const leader = approverCol ? data().getRange(row, approverCol).getDisplayValue().trim() : ''; // << 매핑된 팀장 이름
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
    // AK열(37열): 승인자, AL열(38열): 승인자서명(팀장서명)
    const approverCol = 37; // AK열 - 승인자
    const approverSigCol = 38; // AL열 - 승인자서명 (팀장 서명이 들어가는 곳)
    
    const leaderName = data().getRange(row, approverCol).getDisplayValue().trim();
    console.log(`팀장명: ${leaderName}, 서명을 ${approverSigCol}열(AL)에 삽입`);
    
    insertSig(row, approverSigCol, leaderName);
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
  
  console.log(`찾는 스크립트ID: ${scriptId}`);
  console.log(`시트의 스크립트ID들:`, rows.map(r => r[0]));
  
  for (let [id, url] of rows) {
    console.log(`비교: "${id}" === "${scriptId}" ? ${id === scriptId}`);
    if (id === scriptId) return url; // << 일치 시 URL 반환
  }
  throw new Error(`문서ID시트에서 스크립트ID=${scriptId}를 찾을 수 없습니다.`); // << 없으면 에러
}

/********* 보드 전송 함수 *********/ // << 보드에 데이터 전송 함수
function pushToBoard(boardId, role, srcRow, url) {
  // << 보드에 항목 추가
  const masterId = ss.getId(); // << 마스터 스프레드시트 ID
  const sh = SpreadsheetApp.openById(boardId).getSheets()[0]; // << 보드 시트
  const dstRow = sh.getLastRow() + 1; // << 추가할 행번호

  // 1) A~G 값 쓰기 - 헤더명 기반
  const ts = new Date(); // << 타임스탬프
  const docName = CFG.DOC_NAME; // << 설정에서 문서명 가져오기
  
  // 헤더명으로 컬럼 찾기
  const writerCol = findColumnByHeader(CFG.HEADERS.WRITER);
  const uniqueNameCol = findColumnByHeader(CFG.HEADERS.UNIQUE_NAME);
  
  const vals = [
    ts,
    docName,
    writerCol ? data().getRange(srcRow, writerCol).getValue() : '',
    uniqueNameCol ? data().getRange(srcRow, uniqueNameCol).getValue() : '',
  ];
  sh.getRange(dstRow, 1, 1, 4).setValues([vals]).setNumberFormat('yyyy/MM/dd HH:mm:ss'); // << 쓰기 및 서식 적용

  // 2) 원본 행 번호 및 개인 시트 URL
  sh.getRange(dstRow, 11).setValue(srcRow); // << 원본 행 기록
  if (url) sh.getRange(dstRow, 15).setValue(url); // << 개인 시트 링크 기록

  // 3) IMPORTRANGE 설정 - AL열(승인자서명, 38열) 참조
  const imp = c => `=IMPORTRANGE("${masterId}","A시트!${c}${srcRow}")`; // << IMPORTRANGE 수식
  sh.getRange(dstRow, 8).setFormula(imp('AL')); // << AL열(승인자서명) 참조

  // 4) 체크박스
  sh.getRange(dstRow, 12).insertCheckboxes(); // << 체크박스 삽입

  // 5) 서명 하이퍼링크 (기존 방식 그대로)
  const execUrl = lookupExecUrlByScriptId(ScriptApp.getScriptId()); // << 실행 URL 조회
  sh.getRange(dstRow, 13).setFormula(`=HYPERLINK("${execUrl}?role=${role}&row=${srcRow}","")`); // << 서명 버튼 링크
}

/********* PDF 생성 및 알림 *********/ // << PDF 생성 및 Drive 업로드
function exportPdfAndNotify(row) {
  // << PDF 생성 후 폴더에 저장
  const lock = LockService.getScriptLock();
  lock.waitLock(30000); // << 동시 실행 방지
  try {
    // ▶ 헤더명으로 유니크네임 컬럼 찾아서 시트명 읽기
    const uniqueNameCol = findColumnByHeader(CFG.HEADERS.UNIQUE_NAME);
    if (!uniqueNameCol) throw new Error('유니크네임 헤더를 찾을 수 없습니다');
    
    const sheetName = data().getRange(row, uniqueNameCol).getDisplayValue().trim();
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
      '&scale=1' + // 4 = Fit to Page
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
    blob.setName(`제품품질체크일지(대시보드)_${formatted}_${sheetName}.pdf`); // << Blob 이름 설정
    DriveApp.getFolderById(CFG.PDF_FOLDER).createFile(blob); // << Drive 업로드

    // ④ PDF 생성에 성공한 경우에만 시트 삭제
    ss.deleteSheet(sheet); // << 방금 생성된 개인 시트 삭제
  } finally {
    lock.releaseLock(); // << 락 해제
  }
}

function testExportPdf40() {
  // << 테스트용 PDF 생성 함수
  exportPdfAndNotify(4); // << 25행 테스트
}

// ▶ 간단한 이미지 테스트 함수 (기존 시트 이용)
function quickImageTest() {
  const testRow = 4; // << 이 행 번호만 바꾸세요 (데이터 있는 행)
  
  Logger.log(`=== 간단 이미지 테스트 (행: ${testRow}) ===`);
  
  try {
    // 기존 시트 중에 아무거나 사용 (템플릿 말고)
    const sheets = ss.getSheets();
    let testSheet = null;
    
    // 기존 개인 시트 찾기 (A시트, 문서, B시트 제외)
    for (let sheet of sheets) {
      const name = sheet.getName();
      if (name !== 'A시트' && name !== '문서' && name !== 'B시트' && name !== '문서ID') {
        testSheet = sheet;
        break;
      }
    }
    
    // 없으면 새로 만들기
    if (!testSheet) {
      testSheet = tpl().copyTo(ss).setName('QUICK_TEST');
      Logger.log('새 테스트 시트 생성: QUICK_TEST');
    } else {
      Logger.log(`기존 시트 사용: ${testSheet.getName()}`);
    }
    
    // URL만 빠르게 체크 (AF, AG, AH열)
    const afUrl = data().getRange(testRow, 32).getValue(); // AF열
    const agUrl = data().getRange(testRow, 33).getValue(); // AG열
    const ahUrl = data().getRange(testRow, 34).getValue(); // AH열
    
    Logger.log(`32열(AF): ${afUrl ? 'URL 있음' : '❌ 없음'}`);
    Logger.log(`33열(AG): ${agUrl ? 'URL 있음' : '❌ 없음'}`);
    Logger.log(`34열(AH): ${ahUrl ? 'URL 있음' : '❌ 없음'}`);
    
    // 첫 번째 이미지만 테스트 (빠르게)
    if (afUrl) {
      const afId = extractId(afUrl);
      if (afId) {
        const afBlob = UrlFetchApp.fetch(`https://drive.google.com/thumbnail?sz=w400&id=${afId}`, {
          headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
        }).getBlob();
        testSheet.insertImage(afBlob, 1, 48);
        Logger.log('✅ 첫 번째 이미지 삽입 성공!');
      }
    }
    
  } catch (err) {
    Logger.log('❌ 오류: ' + err.toString());
  }
}

// ▶ 이미지 URL이 있는 행 찾기 함수
function findImageRows() {
  Logger.log(`=== 이미지 URL 있는 행 찾기 ===`);
  
  const lastRow = data().getLastRow();
  Logger.log(`총 ${lastRow}개 행 중에서 이미지 찾는중...`);
  
  let foundRows = [];
  
  for (let row = 2; row <= Math.min(lastRow, 20); row++) { // 최대 20행까지만 체크
    let hasImage = false;
    let rowInfo = `${row}행: `;
    
    for (let col = 32; col <= 34; col++) { // AF, AG, AH열로 변경
      const url = data().getRange(row, col).getValue();
      const colLetter = String.fromCharCode(64 + col);
      
      if (url && url.toString().trim() !== '') {
        const id = extractId(url);
        rowInfo += `${colLetter}열(${id ? '✅' : '❌'}) `;
        hasImage = true;
      } else {
        rowInfo += `${colLetter}열(X) `;
      }
    }
    
    if (hasImage) {
      foundRows.push(row);
      Logger.log(rowInfo + '← 이미지 있음!');
    } else if (row <= 10) {
      Logger.log(rowInfo);
    }
  }
  
  if (foundRows.length > 0) {
    Logger.log(`✅ 이미지가 있는 행: ${foundRows.join(', ')}`);
    Logger.log(`테스트용으로 ${foundRows[0]}행을 사용하세요!`);
  } else {
    Logger.log('❌ 이미지 URL이 없습니다. 36-38열(AJ-AL)에 Google Drive URL을 넣어주세요.');
  }
}

// ▶ 더 간단한 URL만 체크하는 함수
function checkImageUrls() {
  const testRow = 4; // << 이 행만 바꾸세요
  
  Logger.log(`=== URL 체크 (행: ${testRow}) ===`);
  
  for (let col = 32; col <= 34; col++) { // AF, AG, AH열로 변경
    const url = data().getRange(testRow, col).getValue();
    const id = extractId(url);
    const colLetter = String.fromCharCode(64 + col); // 숫자를 알파벳으로
    Logger.log(`${col}열(${colLetter}): URL="${url}" → ID="${id}"`);
  }
}
