/**************** CONFIG ****************/ // << 설정 섹션 시작
const CFG = { // << 전역 설정 객체 선언
  DATA:       'A시트',          // << 메인 데이터 시트 이름
  TEMPLATE:   '문서',           // << 개인 템플릿 시트 이름
  LOOKUP:     'B시트',          // << 이름→대시보드ID 매핑 시트 이름
  MAP_ID:     '문서ID',         // << 스프레드시트ID→스크립트ID→URL 매핑 시트 이름
  COL: { // << 컬럼 인덱스 매핑
    KEY:         5,             // << 키(이름) 컬럼 인덱스
    CEO:     34,             // << 팀장 컬럼 인덱스
    CEO_SIG: 35             // << 팀장 서명 컬럼 인덱스

  },
  BOARD_ID: { // << 보드 ID 매핑
    manager: '1bZD1_-sf-DqFDlxdc_PHxMD2hiqpglP_nP1zZkg54M4' // << 관리자 보드 ID
  },
  PDF_FOLDER: '1b5pxfCTmNKiXf8lSYrr5HI2V6IQnKKD4' // << PDF 저장 폴더 ID
}; // << CFG 객체 끝

const ss   = SpreadsheetApp.getActive(); // << 현재 활성 스프레드시트 참조
const data = () => ss.getSheetByName(CFG.DATA); // << 데이터 시트 가져오는 함수
const tpl  = () => ss.getSheetByName(CFG.TEMPLATE); // << 템플릿 시트 가져오는 함수

/******** 1. 양식 제출 시 – 팀장 보드로 ********/ // << 폼 제출 트리거 부분 시작
function onFormSubmit(e) { // << 폼 제출 시 호출
  const row      = e.range.getRow();                                    // << 제출된 행 번호
  let sheetUrl = '';                                                    // << 개인 시트 URL 초기화

  // ▶ 시트명용 데이터 추출
  const owner   = data().getRange(row, 27).getValue().toString().trim(),// AA열: 주문자
        product = data().getRange(row,  2).getValue().toString().trim(),// B열: 제품명
        weight  = data().getRange(row, 25).getValue().toString().trim(),// Y열: 중량
        lot     = data().getRange(row, 17).getValue().toString().trim(); // Q열: 로트

  if (owner && product && weight && lot) {                              // << 네 값 모두 있을 때만 실행
    // ▶ 기본 시트명 조합 + 불가문자 치환
    const baseName = `${owner}_${product}_${weight}_${lot}`             
                     .replace(/[/\\?%*:|"<>]/g,'-');               // << “주문자_제품명_중량_로트” 형태

    // ▶ 중복 시 “(1)”, “(2)”… 붙여 유니크하게
    let uniqueName = baseName, i = 1;                                   // << 기본 이름 + 카운터
    while (ss.getSheetByName(uniqueName)) {                            
      uniqueName = `${baseName}(${i++})`;                              // << 중복 발견 시 숫자 증가
    }

    // ▶ 템플릿 복사 + 이름 설정 + 타임스탬프 삽입
    const s = tpl().copyTo(ss).setName(uniqueName);                     // << 개인 시트 생성
    s.getRange('C3').setValue(data().getRange(row, 1).getValue());     // << C3에 타임스탬프 기록
    data().getRange(row, 46).setValue(uniqueName);                                  // ▶ 46 에 uniqueName 저장

    // ▶ 개인 시트 URL 생성 (필요 시 활용)
    sheetUrl = ss.getUrl().replace(/\/edit.*$/,'')                     
               + `/edit?gid=${s.getSheetId()}`;                      // << 개인 시트 링크
    // data().getRange(row, 15).setValue(sheetUrl);                     // << URL 저장은 생략 가능
  }

  // ▶ 팀장명 셋업
  data().getRange(row, CFG.COL.CEO)
      .setFormula(`=IFERROR(VLOOKUP(AA${row}, '${CFG.LOOKUP}'!B:H, 5, FALSE),"")`);
  SpreadsheetApp.flush();                                              // << 변경사항 강제 반영

  // ▶ 보드로 전송
  const leader = data().getRange(row, CFG.COL.CEO).getDisplayValue().trim(); // << 매핑된 팀장 이름
  if (leader) {                                                         // << 팀장 이름이 있을 경우
    const info = lookupBoardByName(leader);                             // << 보드 정보 조회
    if (info)                                                         
      pushToBoard(info.boardId, 'leader', row, sheetUrl);              // << 보드에 전송
    else                                                               
      Logger.log('⚠ 매핑된 팀장 보드가 없습니다: ' + leader);          // << 매핑 실패 로그
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
      .setFormula(`=IFERROR(VLOOKUP(L${row}, '${CFG.LOOKUP}'!B:H, ${step.lookupIdx}, FALSE),"")`); // << 다음 이름 매핑
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
  const owner = data().getRange(row,27).getDisplayValue().trim(); // << 신청자 이름
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
  const docName = '제품품질체크일지(대시보드)'; // << 문서명
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
  const imp = c => `=IFERROR(IMPORTRANGE("${masterId}","A시트!${c}${srcRow}"),"")`; // << IMPORTRANGE 수식
  sh.getRange(dstRow,8).setFormula(imp('ai')); // << 서명자
  sh.getRange(dstRow,9).setFormula(imp('O')); // << 다음 서명자
  sh.getRange(dstRow,10).setFormula(imp('Q')); // << 최종 서명자

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
    // ▶ 46열에서 실제 시트명 읽기
    const sheetName = data().getRange(row, 46).getDisplayValue().trim();
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) throw new Error('개인 시트를 찾을 수 없습니다: ' + sheetName);

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
      '&vertical_alignment=MIDDLE' ;

    const blob    = UrlFetchApp.fetch(pdfUrl, { headers:{ Authorization:'Bearer '+ScriptApp.getOAuthToken() } }).getBlob(); // << PDF Blob 가져오기

    const ts        = data().getRange(row,1).getValue(); // << 타임스탬프
    const formatted = Utilities.formatDate(new Date(ts), Session.getScriptTimeZone(), 'yyyy-MM-dd_HH:mm:ss'); // << 파일명 포맷
    blob.setName(`제품품질체크일지(대시보드)_${formatted}_${sheetName}.pdf`); // << Blob 이름 설정
    DriveApp.getFolderById(CFG.PDF_FOLDER).createFile(blob); // << Drive 업로드

    // ④ PDF 생성에 성공한 경우에만 시트 삭제
    ss.deleteSheet(sheet);                                                             // << 방금 생성된 개인 시트 삭제

  } finally {
    lock.releaseLock(); // << 락 해제
  }
}


function testExportPdf40() { // << 테스트용 PDF 생성 함수
  exportPdfAndNotify(4); // << 25행 테스트
}
