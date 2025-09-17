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
    UNIQUE_NAME: 21, // << U열: 유니크네임 컬럼 인덱스
  },
  BOARD_ID: {
    // << 보드 ID 매핑
    manager: '1bZD1_-sf-DqFDlxdc_PHxMD2hiqpglP_nP1zZkg54M4', // << 관리자 보드 ID
  },
  PDF_FOLDER: '1D1d9F6ArRAnSc1IJDw-qM32hZ6gR-Aa7', // << PDF 저장 폴더 ID
}; // << CFG 객체 끝

const ss = SpreadsheetApp.getActive(); // << 현재 활성 스프레드시트 참조
const data = () => ss.getSheetByName(CFG.DATA); // << 데이터 시트 가져오는 함수
const tpl = () => ss.getSheetByName(CFG.TEMPLATE); // << 템플릿 시트 가져오는 함수

/**
 * 새로운 시트명 생성 함수: B열_F열_C열_G열~H열(J열) 형태
 */
function generateSheetName(row) {
  const bCol = data().getRange(row, 2).getValue().toString().trim(); // B열
  const fCol = data().getRange(row, 6).getValue().toString().trim(); // F열
  const cCol = data().getRange(row, 3).getValue().toString().trim(); // C열
  const gCol = data().getRange(row, 7).getValue(); // G열 (날짜)
  const hCol = data().getRange(row, 8).getValue(); // H열 (날짜)
  const jCol = data().getRange(row, 10).getValue().toString().trim(); // J열

  // 날짜 포맷팅 (2025. 8. 5 형태)
  const formatDate = dateVal => {
    if (dateVal instanceof Date) {
      return Utilities.formatDate(dateVal, Session.getScriptTimeZone(), 'yyyy. M. d');
    }
    return dateVal.toString().trim();
  };

  const gFormatted = formatDate(gCol);
  const hFormatted = formatDate(hCol);

  return `${bCol}_${fCol}_${cCol}_${gFormatted}~${hFormatted}(${jCol})`.replace(
    /[/\\?%*:|"<>]/g,
    '-'
  );
}

/******** 1. 양식 제출 시 – 팀장 보드로 ********/ // << 폼 제출 트리거 부분 시작
function onFormSubmit(e) {
  // << 폼 제출 시 호출 함수
  const row = e.range.getRow(); // << 제출된 행 번호
  let sheetUrl = ''; // << 개인 시트 URL 초기화

  // per-person 시트 생성 및 타임스탬프
  const sheetName = generateSheetName(row); // << 새로운 시트명 생성
  if (sheetName) {
    // << 시트명이 생성되면
    const old = ss.getSheetByName(sheetName); // << 기존 시트 확인
    if (old) ss.deleteSheet(old); // << 기존 시트 삭제
    const s = tpl().copyTo(ss).setName(sheetName); // << 템플릿 복사 후 시트 생성
    s.getRange('F5').setValue(data().getRange(row, 1).getValue()); // << 타임스탬프 삽입
    data().getRange(row, CFG.COL.UNIQUE_NAME).setValue(sheetName); // << U열에 시트명 저장
    sheetUrl = ss.getUrl().replace(/\/edit.*$/, '') + `/edit?gid=${s.getSheetId()}`; // << 시트 URL 생성
  }

  // 팀장명 셋업
  data()
    .getRange(row, CFG.COL.LEADER)
    .setFormula(`=IFERROR(VLOOKUP(B${row}, '${CFG.LOOKUP}'!B:H, 5, FALSE),"")`); // << 팀장 이름 매핑
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
  // << GET 요청 처리 함수
  const role = e.parameter.role; // << 요청된 역할 파라미터
  const row = parseInt(e.parameter.row, 10); // << 요청된 행 번호
  if (!role || !row) return out('param err'); // << 파라미터 오류 처리

  const sheetUrl = getPersonalSheetUrl(row); // << 개인 시트 URL 획득
  console.log(`doGet 호출 → role=${role}, row=${row}`); // << 디버그 로그

  const flow = [
    // << 역할별 흐름 정의
    {
      role: 'leader',
      nameCol: CFG.COL.LEADER,
      sigCol: CFG.COL.LEADER_SIG,
      lookupCol: CFG.COL.REVIEWER,
      lookupIdx: 6,
      nextRole: 'reviewer',
    },
    {
      role: 'reviewer',
      nameCol: CFG.COL.REVIEWER,
      sigCol: CFG.COL.REVIEWER_SIG,
      lookupCol: CFG.COL.CEO,
      lookupIdx: 7,
      nextRole: 'ceo',
    },
    { role: 'ceo', nameCol: CFG.COL.CEO, sigCol: CFG.COL.CEO_SIG },
  ]; // << 각 단계별 설정

  const step = flow.find(f => f.role === role); // << 현재 역할 단계 찾기
  if (!step) return out('invalid role'); // << 유효하지 않은 역할 처리

  // (A) 서명 삽입
  const name = data().getRange(row, step.nameCol).getDisplayValue().trim(); // << 서명할 이름 획득
  insertSig(row, step.sigCol, name); // << 서명 수식 삽입
  SpreadsheetApp.flush(); // << 변경사항 반영

  // (B) 다음 역할이 있으면
  if (step.lookupCol) {
    // << 리뷰어 또는 CEO 단계 전
    data()
      .getRange(row, step.lookupCol)
      .setFormula(`=IFERROR(VLOOKUP(L${row}, '${CFG.LOOKUP}'!B:H, ${step.lookupIdx}, FALSE),"")`); // << 다음 이름 매핑
    SpreadsheetApp.flush(); // << 반영

    const nextName = data().getRange(row, step.lookupCol).getDisplayValue().trim(); // << 다음 역할 이름
    if (nextName) {
      // << 이름이 있으면
      const info = lookupBoardByName(nextName); // << 보드 정보 조회
      if (info) pushToBoard(info.boardId, step.nextRole, row, sheetUrl); // << 보드에 전송
      else Logger.log(`⚠ 매핑된 ${step.nextRole} 보드가 없습니다: ` + nextName); // << 매핑 실패
    }
  }
  // (C) CEO 단계
  else {
    // << 마지막 단계인 CEO 서명 후 처리
    updateRowInCalendar(data(), row); // << 캘린더 등록
    exportPdfAndNotify(row); // << PDF 생성 및 알림
  }

  return out('서명 완료'); // << 응답
}
function out(msg) {
  return HtmlService.createHtmlOutput(msg);
} // << HTML 출력 헬퍼

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

/********* 개인 시트 URL 계산 *********/ // << 개인 시트 URL 계산 함수
function getPersonalSheetUrl(row) {
  const sheetName = data().getRange(row, CFG.COL.UNIQUE_NAME).getDisplayValue().trim(); // << U열에서 시트명 읽기
  if (!sheetName) return ''; // << 시트명 없으면 빈 문자열
  const sh = ss.getSheetByName(sheetName); // << 시트 객체
  return sh
    ? ss.getUrl().replace(/\/edit.*$/, '') + `/edit?gid=${sh.getSheetId()}` // << URL
    : ''; // << 없으면 빈
}

/********* PDF 생성 함수 (code.js 로직 적용) *********/ // << PDF 생성 및 Drive 업로드 (파일 ID 반환)
function createPdfFromSheet(row, moveOldToTrash = false) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000); // << 동시 실행 방지

  try {
    // ① U열에서 시트명 읽기
    const sheetName = data().getRange(row, CFG.COL.UNIQUE_NAME).getDisplayValue().trim();
    if (!sheetName) {
      throw new Error('시트명을 찾을 수 없습니다');
    }

    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      throw new Error('시트를 찾을 수 없습니다: ' + sheetName);
    }

    // ② PDF URL 구성 및 Blob 생성
    const baseUrl = ss.getUrl().replace(/\/edit$/, ''); // << 스프레드시트 기본 URL
    const gid = sheet.getSheetId(); // << 대상 시트 GID
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
      headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }, // << OAuth 토큰 사용
    }).getBlob(); // << PDF Blob 생성

    // ③ 파일명 설정
    const ts = data().getRange(row, 1).getValue(); // << A열: 타임스탬프
    const formatted = Utilities.formatDate(
      new Date(ts),
      Session.getScriptTimeZone(),
      'yyyy-MM-dd_HH:mm:ss'
    );
    const fileName = `전자서명 휴가신청서(대시보드)_${formatted}_${sheetName}.pdf`;
    blob.setName(fileName);

    const folder = DriveApp.getFolderById(CFG.PDF_FOLDER);

    // ④ 기존 파일 휴지통 이동 (서명 완료 시)
    if (moveOldToTrash) {
      console.log(`[PDF생성] 기존 파일 휴지통 이동 중: ${fileName}`);

      // 정확한 파일명 패턴으로 검색
      const filePrefix = '전자서명 휴가신청서(대시보드)_';
      const fileSuffix = `.pdf`;

      const allFiles = folder.getFiles();
      let trashCount = 0;

      // 폴더 내 매칭 파일들을 휴지통으로 이동
      while (allFiles.hasNext()) {
        const file = allFiles.next();
        const currentFileName = file.getName();

        // 정확한 패턴 매칭: 시작 부분 + 시트명 + .pdf
        if (
          currentFileName.startsWith(filePrefix) &&
          currentFileName.includes(`_${sheetName}${fileSuffix}`)
        ) {
          try {
            file.setTrashed(true);
            trashCount++;
            console.log(`[PDF생성] 파일 휴지통 이동 성공: ${currentFileName}`);
          } catch (error) {
            console.log(`[PDF생성] 파일 휴지통 이동 실패: ${currentFileName} - ${error.message}`);
          }
        }
      }

      console.log(`[PDF생성] 휴지통 이동 완료 - 총 ${trashCount}개 파일 처리`);
    }

    // ⑤ 새 PDF 파일 생성
    const pdfFile = folder.createFile(blob);

    return pdfFile.getId(); // << PDF 파일 ID 반환
  } finally {
    lock.releaseLock(); // << 락 해제 (항상 실행)
  }
}

/********* 보드 전송 함수 *********/ // << 보드에 데이터 전송 함수
function pushToBoard(boardId, role, srcRow, url) {
  // << 보드에 항목 추가
  const masterId = ss.getId(); // << 마스터 스프레드시트 ID
  const sh = SpreadsheetApp.openById(boardId).getSheets()[0]; // << 보드 시트
  const dstRow = sh.getLastRow() + 1; // << 추가할 행번호

  // PDF 생성 (기존 파일 휴지통 이동)
  const pdfFileId = createPdfFromSheet(srcRow, true); // << PDF 생성 및 기존 파일 휴지통 이동

  // 1) A~G 값 쓰기
  const ts = new Date(); // << 타임스탬프
  const docName = '전자서명 휴가신청서(대시보드)'; // << 문서명
  const sheetName = data().getRange(srcRow, CFG.COL.UNIQUE_NAME).getDisplayValue().trim(); // << U열에서 시트명
  const vals = [
    ts,
    docName,
    data().getRange(srcRow, 2).getValue(),
    sheetName, // << D열에 시트명 입력
    data().getRange(srcRow, 7).getValue(),
    data().getRange(srcRow, 8).getValue(),
    data().getRange(srcRow, 10).getValue(),
  ]; // << 전송할 데이터
  sh.getRange(dstRow, 1, 1, 7).setValues([vals]).setNumberFormat('yyyy/MM/dd HH:mm:ss'); // << 쓰기 및 서식 적용

  // 2) 원본 행 번호 및 개인 시트 URL
  sh.getRange(dstRow, 11).setValue(srcRow); // << 원본 행 기록
  if (url) sh.getRange(dstRow, 14).setValue(url); // << 개인 시트 링크 기록 (N열로 변경)

  // 3) IMPORTRANGE 설정
  const imp = c => `=IFERROR(IMPORTRANGE("${masterId}","A시트!${c}${srcRow}"),"")`; // << IMPORTRANGE 수식
  sh.getRange(dstRow, 8).setFormula(imp('M')); // << 서명자
  sh.getRange(dstRow, 9).setFormula(imp('O')); // << 다음 서명자
  sh.getRange(dstRow, 10).setFormula(imp('Q')); // << 최종 서명자

  // 4) 체크박스
  sh.getRange(dstRow, 12).insertCheckboxes(); // << 체크박스 삽입

  // 5) 서명 하이퍼링크
  const execUrl = lookupExecUrlByScriptId(ScriptApp.getScriptId()); // << 실행 URL 조회
  sh.getRange(dstRow, 13).setFormula(`=HYPERLINK("${execUrl}?role=${role}&row=${srcRow}","")`); // << 서명 버튼 링크

  // 6) PDF 파일 ID를 O열에 기록
  sh.getRange(dstRow, 15).setValue(pdfFileId); // << PDF 파일 ID 기록
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

/********* 최종 PDF 생성 및 알림 *********/ // << PDF 생성 및 Drive 업로드
function exportPdfAndNotify(row) {
  // << PDF 생성 후 폴더에 저장
  const lock = LockService.getScriptLock();
  lock.waitLock(30000); // << 동시 실행 방지
  try {
    const sheetName = data().getRange(row, CFG.COL.UNIQUE_NAME).getDisplayValue().trim(); // << U열에서 시트명
    const sheet = ss.getSheetByName(sheetName); // << 시트 객체
    if (!sheet) throw new Error('시트를 찾을 수 없습니다: ' + sheetName); // << 예외 처리

    const folder = DriveApp.getFolderById(CFG.PDF_FOLDER);

    // ① 기존 파일 휴지통 이동
    console.log(`[최종PDF생성] 기존 파일 휴지통 이동 중: ${sheetName}`);

    const filePrefix = '전자서명 휴가신청서(대시보드)_';
    const fileSuffix = `.pdf`;

    const allFiles = folder.getFiles();
    let trashCount = 0;

    // 폴더 내 매칭 파일들을 휴지통으로 이동
    while (allFiles.hasNext()) {
      const file = allFiles.next();
      const currentFileName = file.getName();

      // 정확한 패턴 매칭: 시작 부분 + 시트명 + .pdf
      if (
        currentFileName.startsWith(filePrefix) &&
        currentFileName.includes(`_${sheetName}${fileSuffix}`)
      ) {
        try {
          file.setTrashed(true);
          trashCount++;
          console.log(`[최종PDF생성] 파일 휴지통 이동 성공: ${currentFileName}`);
        } catch (error) {
          console.log(`[최종PDF생성] 파일 휴지통 이동 실패: ${currentFileName} - ${error.message}`);
        }
      }
    }

    console.log(`[최종PDF생성] 휴지통 이동 완료 - 총 ${trashCount}개 파일 처리`);

    // ② PDF 생성
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
    const fileName = `전자서명 휴가신청서(대시보드)_${formatted}_${sheetName}.pdf`; // << 파일명 통일
    blob.setName(fileName); // << Blob 이름 설정
    folder.createFile(blob); // << Drive 업로드

    // ③ 임시시트 삭제
    console.log(`[최종PDF생성] 임시시트 삭제 중: ${sheetName}`);
    try {
      ss.deleteSheet(sheet);
      console.log(`[최종PDF생성] 임시시트 삭제 완료: ${sheetName}`);
    } catch (error) {
      console.log(`[최종PDF생성] 임시시트 삭제 실패: ${sheetName} - ${error.message}`);
    }
  } finally {
    lock.releaseLock(); // << 락 해제
  }
}

function testExportPdf40() {
  // << 테스트용 PDF 생성 함수
  exportPdfAndNotify(25); // << 25행 테스트
}
