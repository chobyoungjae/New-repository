/**************** CONFIG ****************/ // << 설정 섹션 시작
const CFG = { // << 전역 설정 객체 선언
  DATA:       'A시트',          // << 메인 데이터 시트 이름
  TEMPLATE:   '문서',           // << 개인 템플릿 시트 이름
  LOOKUP:     'B시트',          // << 이름→대시보드ID 매핑 시트 이름
  MAP_ID:     '문서ID',         // << 스프레드시트ID→스크립트ID→URL 매핑 시트 이름
  COL: { // << 컬럼 인덱스 매핑
    KEY:         5,             // << 키(이름) 컬럼 인덱스
    CEO:     17,             // << 팀장 컬럼 인덱스                                @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
    CEO_SIG: 18             // << 팀장 서명 컬럼 인덱스                             @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@

  },
  BOARD_ID: { // << 보드 ID 매핑
    manager: '1bZD1_-sf-DqFDlxdc_PHxMD2hiqpglP_nP1zZkg54M4' // << 관리자 보드 ID   @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
  },
  PDF_FOLDER: '1iwIgwJCc2t2-LSK-eIFnXOFL2ntFaiaJ' // << PDF 저장 폴더 ID           @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
}; // << CFG 객체 끝

const ss   = SpreadsheetApp.getActive(); // << 현재 활성 스프레드시트 참조
const data = () => ss.getSheetByName(CFG.DATA); // << 데이터 시트 가져오는 함수
const tpl  = () => ss.getSheetByName(CFG.TEMPLATE); // << 템플릿 시트 가져오는 함수

/******** 1. 양식 제출 시 – 팀장 보드로 ********/ // << 폼 제출 트리거 부분 시작
function onFormSubmit(e) {
  const row    = e.range.getRow();                                                           // 이벤트가 발생한 행 번호를 가져옵니다.
  const status = data().getRange(row, 2).getValue().toString().trim();                       // A시트의 B열(2열)에서 상태 값을 읽어와 공백을 제거합니다.
  let sheetUrl = '';                                                                          // 개인 시트 URL을 담을 변수를 초기화합니다.

  if (status === '작업 시작 시') {
  const owner   = data().getRange(row, 12).getValue().toString().trim();                      // A시트의 L열(12열)에서 ‘주문자’ 가져오기
  const product = data().getRange(row, 3).getValue().toString().trim();                       // A시트의 C열(3열)에서 ‘제품명’ 가져오기
  const sheetName = `${owner}_${product}`.replace(/[/\\?%*:|"<>]/g,'-');                       // “주문자_제품명” 조합 및 불가문자 치환
  if (sheetName) {
    const old = ss.getSheetByName(sheetName);                                                 // 같은 이름 시트가 있으면
    if (old) ss.deleteSheet(old);                                                             // 삭제
    const s = tpl().copyTo(ss).setName(sheetName);                                            // 템플릿 복사 후 “주문자_제품명”으로 시트 생성
    s.getRange('M10').setValue(data().getRange(row, 1).getValue());                           // M10에 A열 타임스탬프 기록
    sheetUrl = ss.getUrl().replace(/\/edit.*$/,'') + `/edit?gid=${s.getSheetId()}`;           // 생성된 시트 URL 계산
    data().getRange(row, 15).setValue(sheetUrl);                                              // O열(15열)에 URL 저장
  }
}

  else if (status === '작업 중') {
  const owner   = data().getRange(row, 12).getValue().toString().trim();              // A시트의 L열(12열)에서 주문자 가져오기
  const product = data().getRange(row, 3).getValue().toString().trim();               // A시트의 C열(3열)에서 제품명 가져오기
  const sheetName = `${owner}_${product}`                                             // “주문자_제품명” 조합
    .replace(/[/\\?%*:|"<>]/g,'-');                                                    // 파일명 불가문자 치환

  if (!sheetName) return;                                                              // 조합된 이름이 없으면 종료
  const sh = ss.getSheetByName(sheetName);                                            // 해당 이름의 시트 가져오기
  if (!sh) return;                                                                     // 시트가 없으면 종료

  const mVals   = sh.getRange('M10:M').getValues().flat();                             // M10부터 아래 모든 값
  const nextRow = 10 + mVals.filter(v => v !== '').length;                             // 다음 빈 행 계산
  sh.getRange(`M${nextRow}`).setValue(data().getRange(row, 1).getValue());             // 그 행에 타임스탬프 기록
}

  else if (status === '제품생산 완료') {
  const owner   = data().getRange(row, 12).getValue().toString().trim();            // A시트의 L열(12열)에서 주문자 가져오기
  const product = data().getRange(row, 3).getValue().toString().trim();             // A시트의 C열(3열)에서 제품명 가져오기
  const sheetName = `${owner}_${product}`                                           // “주문자_제품명” 조합
    .replace(/[/\\?%*:|"<>]/g,'-');                                                  // 파일명 불가문자 치환

  if (!sheetName) return;                                                            // 조합된 이름이 없으면 종료
  const sh = ss.getSheetByName(sheetName);                                          // 해당 이름의 시트 가져오기
  if (!sh) return;                                                                   // 시트가 없으면 종료

  const mVals   = sh.getRange('M10:M').getValues().flat();                           // M10부터 아래 모든 값
  const nextRow = 10 + mVals.filter(v => v !== '').length;                           // 다음 빈 행 계산
  sh.getRange(`M${nextRow}`).setValue(data().getRange(row, 1).getValue());           // 그 행에 타임스탬프 기록

    // ─── 여기가 핵심 ───
    // “제품생산 완료” 시점에도 개인 시트의 gid를 다시 꺼내서 sheetUrl을 재계산해 줘야 O열에 들어갑니다.
    sheetUrl = ss.getUrl().replace(/\/edit.*$/,'') + `/edit?gid=${sh.getSheetId()}`;         // 개인 시트의 URL을 다시 계산하여 sheetUrl에 저장합니다.

    // 팀장 매핑(예: F열 값을 기준으로 B시트에서 VLOOKUP하여 CEO 이름 찾기) 후 pushToBoard
    data().getRange(row, CFG.COL.CEO)                                                         // A시트의 해당 행, CEO(팀장) 열 셀을 선택하고
      .setFormula(`=IFERROR(VLOOKUP(F${row}, '${CFG.LOOKUP}'!B:H, 5, FALSE),"")`);            // F열(제품생산 완료인 행의 값)을 기준으로 B시트에서 팀장 이름을 찾아 넣는 수식을 설정합니다.
    SpreadsheetApp.flush();                                                                   // 시트 변경사항을 즉시 반영합니다.
    const leader = data().getRange(row, CFG.COL.CEO).getDisplayValue().trim();               // 방금 삽입된 수식으로 매핑된 팀장 이름을 가져옵니다.
    if (leader) {
      const info = lookupBoardByName(leader);                                                 // lookupBoardByName으로 해당 팀장의 보드 ID를 조회합니다.
      if (info) pushToBoard(info.boardId, 'leader', row, sheetUrl);                          // 보드 ID와 role, row, sheetUrl을 넘겨 pushToBoard를 호출하여 보드에 전송합니다.
    }
  }
}




/******** 2. 역할별 흐름 – Web App 호출 ********/ // << 역할별 처리 Web App 시작
function doGet(e) { // << GET 요청 처리 함수
  const role = e.parameter.role; // << 요청된 역할 파라미터
  const row  = parseInt(e.parameter.row, 10); // << 요청된 행 번호
  if (!role || !row) return out('param err'); // << 파라미터 오류 처리

  const sheetUrl = getPersonalSheetUrl(row); // << 개인 시트 URL 획득
  console.log(`doGet 호출 → role=${role}, row=${row}`); // << 디버그 로그

  const flow = [ // << 역할별 흐름 정의
    { role: 'leader',   nameCol: CFG.COL.CEO,      sigCol: CFG.COL.CEO_SIG }
  ]; // << 각 단계별 설정

  const step = flow.find(f => f.role === role); // << 현재 역할 단계 찾기
  if (!step) return out('invalid role'); // << 유효하지 않은 역할 처리

    // (A) 서명 삽입
  const name = data().getRange(row, step.nameCol).getDisplayValue().trim(); // << 서명할 이름 획득
  insertSig(row, step.sigCol, name); // << 서명 수식 삽입
  SpreadsheetApp.flush(); // << 변경사항 반영

  // (B) 다음 역할이 있으면
  if (step.lookupCol) { // << 리뷰어 또는 CEO 단계 전
    data().getRange(row, step.lookupCol)
      .setFormula(`=IFERROR(VLOOKUP(f${row}, '${CFG.LOOKUP}'!B:H, ${step.lookupIdx}, FALSE),"")`); // << 다음 이름 매핑
    SpreadsheetApp.flush(); // << 반영

    const nextName = data().getRange(row, step.lookupCol).getDisplayValue().trim(); // << 다음 역할 이름
    if (nextName) { // << 이름이 있으면
      const info = lookupBoardByName(nextName); // << 보드 정보 조회
      if (info) pushToBoard(info.boardId, step.nextRole, row, sheetUrl); // << 보드에 전송
      else Logger.log(`⚠ 매핑된 ${step.nextRole} 보드가 없습니다: ` + nextName); // << 매핑 실패
    }
  }
  // (C) CEO 단계
  else { // << 마지막 단계인 CEO 서명 후 처리
    exportPdfAndNotify(row); // << PDF 생성 및 알림
  }

  return out('서명 완료'); // << 응답
}
function out(msg) { return HtmlService.createHtmlOutput(msg); } // << HTML 출력 헬퍼

/********* 서명 수식 삽입 *********/ // << 서명 수식 삽입 함수
function insertSig(row, col, name) { // << 지정된 셀에 서명 수식 넣기
  const f = `=IFERROR(VLOOKUP("${name}", '${CFG.LOOKUP}'!B:E, 4, FALSE),"서명없음")`; // << 서명 수식 생성
  data().getRange(row, col).setFormula(f); // << 수식 삽입
  SpreadsheetApp.flush(); // << 반영
}

/********* 이름→보드ID 매핑 *********/ // << 보드 ID 조회 함수
function lookupBoardByName(name) { // << 이름으로 보드 ID 찾기
  const mapSh = ss.getSheetByName(CFG.MAP_ID); // << 매핑 시트 가져오기
  const last  = mapSh.getLastRow(); // << 마지막 행
  if (last < 2) return null; // << 데이터 없음
  const vals = mapSh.getRange(2, 2, last - 1, 2).getValues(); // << 매핑 값 읽기
  for (let [n, id] of vals) { // << 매핑 루프
    if (n.toString().trim() === name) return { boardId: id.toString().trim() }; // << 매칭 시 반환
  }
  return null; // << 없으면 null
}

/********* 스크립트ID→URL 매핑 *********/ // << 실행 URL 조회 함수
function lookupExecUrlByScriptId(scriptId) { // << 스크립트 ID로 URL 찾기
  const sh   = ss.getSheetByName(CFG.MAP_ID); // << 매핑 시트
  const last = sh.getLastRow(); // << 마지막 행
  const rows = sh.getRange(2, 4, last - 1, 2).getDisplayValues(); // << ID-URL 읽기
  for (let [id, url] of rows) { // << 루프
    if (id === scriptId) return url; // << 일치 시 URL 반환
  }
  throw new Error(`C시트에서 스크립트ID=${scriptId}를 찾을 수 없습니다.`); // << 없으면 에러
}

/********* 개인 시트 URL 계산 *********/ // << 개인 시트 URL 계산 함수
function getPersonalSheetUrl(row) {
  const owner = data().getRange(row,12).getDisplayValue().trim(); // << 신청자 이름   @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@  제품검수일지에서만 라인명으로 기준
  if (!owner) return ''; // << 이름 없으면 빈 문자열
  const sh = ss.getSheetByName(owner); // << 개인 시트
  return sh
    ? ss.getUrl().replace(/\/edit.*$/,'') + `/edit?gid=${sh.getSheetId()}` // << URL
    : ''; // << 없으면 빈
}

/********* 보드 전송 함수 *********/ // << 보드에 데이터 전송 함수
function pushToBoard(boardId, role, srcRow, url) { // << 보드에 항목 추가
  const masterId = ss.getId(); // << 마스터 스프레드시트 ID
  const sh       = SpreadsheetApp.openById(boardId).getSheets()[0]; // << 보드 시트
  const dstRow   = sh.getLastRow() + 1; // << 추가할 행번호

  // 1) A~G 값 쓰기
  const ts      = new Date(); // << 타임스탬프
  const docName = '1동 제품검수일지(대시보드)'; // << 문서명                                 @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
  const vals    = [ts, docName,
                   data().getRange(srcRow,2).getValue(),
                   data().getRange(srcRow,3).getValue(),
                   data().getRange(srcRow,7).getValue(),
                   data().getRange(srcRow,8).getValue(),
                   data().getRange(srcRow,10).getValue()]; // << 전송할 데이터
  sh.getRange(dstRow,1,1,7).setValues([vals]).setNumberFormat("yyyy/MM/dd HH:mm:ss"); // << 쓰기 및 서식 적용

  // 2) 원본 행 번호 및 개인 시트 URL
  sh.getRange(dstRow,11).setValue(srcRow); // << 원본 행 기록
  if (url) sh.getRange(dstRow,15).setValue(url); // << 개인 시트 링크 기록

  // 3) IMPORTRANGE 설정
  const imp = c => `=IMPORTRANGE("${masterId}","A시트!${c}${srcRow}")`; // << IMPORTRANGE 수식
  sh.getRange(dstRow,8).setFormula(imp('r')); // << 서명자                                @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
  // sh.getRange(dstRow,9).setFormula(imp('r')); // << 다음 서명자                          @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
  // sh.getRange(dstRow,10).setFormula(imp('')); // << 최종 서명자                         @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@

  // 4) 체크박스
  sh.getRange(dstRow,12).insertCheckboxes(); // << 체크박스 삽입

  // 5) 서명 하이퍼링크
  const execUrl = lookupExecUrlByScriptId(ScriptApp.getScriptId()); // << 실행 URL 조회
  sh.getRange(dstRow,13)
    .setFormula(`=HYPERLINK("${execUrl}?role=${role}&row=${srcRow}","")`); // << 서명 버튼 링크
}


/********* PDF 생성 및 알림 *********/ // << PDF 생성 및 Drive 업로드
function exportPdfAndNotify(row) { // << PDF 생성 후 폴더에 저장
  const lock = LockService.getScriptLock(); lock.waitLock(30000); // << 동시 실행 방지
  try {
    const owner   = data().getRange(row,12).getDisplayValue().trim(); // << L열: 주문자          @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@ 제품검수일지에서만 라인명으로 기준
    const product = data().getRange(row, 3).getDisplayValue().trim(); // << C열: 제품명
    const sheetName = `${owner}_${product}`                            // << “주문자_제품명” 조합
      .replace(/[/\\?%*:|"<>]/g,'-');                                  // << 파일명 불가문자 치환
    const sheet = ss.getSheetByName(sheetName);                        // << 조합된 이름으로 시트 조회
    if (!sheet) throw new Error('개인 시트를 찾을 수 없습니다: ' + sheetName); // << sheetName 기준으로 예외 처리


    const baseUrl = ss.getUrl().replace(/\/edit$/,''); // << 기본 URL
    const gid     = sheet.getSheetId(); // << 시트 ID
    const pdfUrl =
      baseUrl + '/export?format=pdf' +
      '&gid='               + gid +        // 출력할 시트 ID
      '&size=A4' +                      // 용지 크기
      '&portrait=true' +                // 세로 방향
      '&scale=4' +                      // 4 = Fit to Page
      '&top_margin=0.2' +               // 여백 최소화
      '&bottom_margin=0.2' +
      '&left_margin=0.2' +
      '&right_margin=0.2' +
      '&gridlines=false' +              // 격자선 숨김
      '&sheetnames=false' +             // 시트 이름 숨김
      '&printtitle=false' +             // 스프레드시트 제목 숨김
      '&horizontal_alignment=CENTER' +  // 가로 중앙 정렬:contentReference[oaicite:0]{index=0}
      '&vertical_alignment=MIDDLE' +
      '&r1=0&r2=14&c1=0&c2=9';          //

    const blob    = UrlFetchApp.fetch(pdfUrl, { headers:{ Authorization:'Bearer '+ScriptApp.getOAuthToken() } }).getBlob(); // << PDF Blob 가져오기

    const ts        = data().getRange(row,1).getValue(); // << 타임스탬프
    const formatted = Utilities.formatDate(new Date(ts), Session.getScriptTimeZone(), 'yyyy-MM-dd_HH:mm:ss'); // << 파일명 포맷
    blob.setName(`1동 제품검수일지(대시보드)_${formatted}_${sheetName}.pdf`);        // << sheetName 기준으로 파일명 설정

    DriveApp.getFolderById(CFG.PDF_FOLDER).createFile(blob); // << Drive 업로드
  } finally {
    lock.releaseLock(); // << 락 해제
  }
}


function testExportPdf40() { // << 테스트용 PDF 생성 함수
  exportPdfAndNotify(2); // << 25행 테스트
}
