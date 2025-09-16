

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
const out = msg => ContentService.createTextOutput(msg); // << 웹앱 응답 함수

// << 성능 최적화: 룩업 테이블 캐시
let boardLookupCache = new Map(); // << 보드 ID 캐시
let execUrlCache = new Map(); // << 실행 URL 캐시
let cacheTimestamp = 0; // << 캐시 타임스탬프
const CACHE_DURATION = 5 * 60 * 1000; // << 5분 캐시

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
    if (info) pushToBoard(info.boardId, 'leader', row); // << 보드에 전송 (URL 파라미터 제거)
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

/********* 이름→보드ID 매핑 (성능 최적화: 캐시 적용) *********/ // << 보드 ID 조회 함수
function lookupBoardByName(name) {
  // << 성능 최적화: 캐시 확인
  const now = Date.now();
  if (now - cacheTimestamp > CACHE_DURATION) {
    // << 캐시 만료 시 갱신
    refreshBoardLookupCache();
    cacheTimestamp = now;
  }

  // << 캐시에서 조회 (O(1))
  const boardId = boardLookupCache.get(name);
  return boardId ? { boardId } : null;
}

/**
 * 보드 룩업 캐시 갱신 (성능 최적화)
 */
function refreshBoardLookupCache() {
  boardLookupCache.clear();
  const mapSh = ss.getSheetByName(CFG.MAP_ID);
  const last = mapSh.getLastRow();
  if (last < 2) return;

  // << 배치 읽기로 전체 매핑 데이터 로드
  const vals = mapSh.getRange(2, 2, last - 1, 2).getValues();
  for (let [n, id] of vals) {
    if (n && id) {
      boardLookupCache.set(n.toString().trim(), id.toString().trim());
    }
  }
}

/********* 스크립트ID→URL 매핑 (성능 최적화: 캐시 적용) *********/ // << 실행 URL 조회 함수
function lookupExecUrlByScriptId(scriptId) {
  // << 성능 최적화: 캐시 확인
  const now = Date.now();
  if (now - cacheTimestamp > CACHE_DURATION) {
    // << 캐시 만료 시 갱신
    refreshExecUrlCache();
  }

  // << 캐시에서 조회 (O(1))
  const url = execUrlCache.get(scriptId);
  if (url) return url;

  throw new Error(`C시트에서 스크립트ID=${scriptId}를 찾을 수 없습니다.`);
}

/**
 * 실행 URL 캐시 갱신 (성능 최적화)
 */
function refreshExecUrlCache() {
  execUrlCache.clear();
  const sh = ss.getSheetByName(CFG.MAP_ID);
  const last = sh.getLastRow();
  if (last < 2) return;

  // << 배치 읽기로 전체 URL 매핑 데이터 로드
  const rows = sh.getRange(2, 4, last - 1, 2).getDisplayValues();
  for (let [id, url] of rows) {
    if (id && url) {
      execUrlCache.set(id, url);
    }
  }
}

/********* 보드 전송 함수 *********/ // << 보드에 데이터 전송 함수
function pushToBoard(boardId, role, srcRow) {
  // << 보드에 항목 추가
  const masterId = ss.getId(); // << 마스터 스프레드시트 ID
  const sh = SpreadsheetApp.openById(boardId).getSheets()[0]; // << 보드 시트
  const dstRow = sh.getLastRow() + 1; // << 추가할 행번호

  // PDF 생성하고 파일 ID 획득
  const pdfFileId = createPdfFromSheet(srcRow, false); // << 첫 번째 PDF 생성

  // 1) A~G 값 쓰기 (성능 최적화: 배치 읽기)
  const ts = new Date(); // << 타임스탬프
  const docName = '청소상태 체크일지(대시보드)'; // << 문서명

  // << 성능 최적화: 한 번에 필요한 데이터 읽기
  const sourceData = data().getRange(srcRow, 2, 1, 18).getValues()[0]; // B~S열 배치 읽기

  const vals = [
    ts,
    docName,
    sourceData[0], // B열 (인덱스 0)
    sourceData[17], // S열(19) (인덱스 17) - uniqueName
  ];
  sh.getRange(dstRow, 1, 1, 4).setValues([vals]).setNumberFormat('yyyy/MM/dd HH:mm:ss'); // << 쓰기 및 서식 적용

  // 2) 원본 행 번호 및 PDF 파일 ID (성능 최적화: 배치 쓰기)
  const metaData = [[srcRow], [null], [null], [null], [pdfFileId]]; // K, L, M, N, O열
  sh.getRange(dstRow, 11, 1, 5).setValues([metaData.flat()]); // << 배치 쓰기

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

/********* PDF 생성 함수 *********/ // << PDF 생성 및 Drive 업로드 (파일 ID 반환)
function createPdfFromSheet(row, moveOldToTrash = false) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000); // << 동시 실행 방지, 안정적인 처리

  try {
    // ① 19열에서 실제 시트명 읽기 (청소상태 체크일지는 19열에 uniqueName 저장)
    const sheetName = data().getRange(row, 19).getDisplayValue().trim();
    if (!sheetName) {
      throw new Error('시트명을 찾을 수 없습니다');
    }

    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      throw new Error('시트를 찾을 수 없습니다: ' + sheetName);
    }

    // ② PDF URL 구성 및 Blob 생성 (성능 최적화: URL 캐싱)
    const baseUrl = ss.getUrl().replace(/\/edit$/, ''); // << 스프레드시트 기본 URL
    const gid = sheet.getSheetId(); // << 대상 시트 GID

    // << 기존 청소상태 체크일지 PDF 설정 유지 (사이즈 변경 금지)
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
      '&horizontal_alignment=CENTER' + // 가로 중앙 정렬
      '&vertical_alignment=MIDDLE'; // 세로 중앙 정렬

    // << 성능 최적화: OAuth 토큰 캐싱
    const oauthToken = ScriptApp.getOAuthToken();
    const blob = UrlFetchApp.fetch(pdfUrl, {
      headers: { Authorization: `Bearer ${oauthToken}` },
    }).getBlob();

    // ③ 파일명 설정 (청소상태 체크일지에 맞게 조정)
    const ts = data().getRange(row, 1).getValue(); // << A열: 타임스탬프
    const formatted = Utilities.formatDate(
      new Date(ts),
      Session.getScriptTimeZone(),
      'yyyy-MM-dd_HH:mm:ss'
    );
    const fileName = `청소상태 체크일지(대시보드)_${formatted}_${sheetName}.pdf`;
    blob.setName(fileName);

    const folder = DriveApp.getFolderById(CFG.PDF_FOLDER);

    // ④ 기존 파일 휴지통 이동 (서명 완료 시)
    if (moveOldToTrash) {
      console.log(`[PDF생성] 기존 파일 휴지통 이동 중: ${fileName}`);

      // 폴더 접근 권한 확인
      try {
        const folderName = folder.getName();
        console.log(`[PDF생성] 폴더 접근 성공: ${folderName}`);
      } catch (error) {
        console.log(`[PDF생성] 폴더 접근 실패: ${error.message}`);
        return null; // << PDF 파일 ID 반환 대신 null 반환
      }

      // 정확한 파일명 패턴으로 검색 (청소상태 체크일지에 맞게 조정)
      const filePrefix = '청소상태 체크일지(대시보드)_';
      const fileSuffix = `.pdf`;
      const searchPattern = `${filePrefix}*_${sheetName}${fileSuffix}`;
      console.log(`[PDF생성] 검색 패턴: ${searchPattern}`);

      const allFiles = folder.getFiles();
      let totalFiles = 0;
      let trashCount = 0;
      const foundFiles = [];

      // 폴더 내 모든 파일 목록 출력 (성능 최적화: 배치 처리)
      const filesToProcess = [];
      while (allFiles.hasNext()) {
        const file = allFiles.next();
        const currentFileName = file.getName();
        totalFiles++;

        // 정확한 패턴 매칭: 시작 부분 + 시트명 + .pdf
        if (
          currentFileName.startsWith(filePrefix) &&
          currentFileName.includes(`_${sheetName}${fileSuffix}`)
        ) {
          trashCount++;
          filesToProcess.push({ name: currentFileName, id: file.getId() });
          console.log(`[PDF생성] 매칭 파일 ${trashCount} 발견: ${currentFileName}`);
        }
      }

      // << 성능 최적화: 발견된 파일들을 foundFiles에 한 번에 추가
      foundFiles.push(...filesToProcess);

      console.log(`[PDF생성] 폴더 내 총 ${totalFiles}개 파일, 매칭 파일 ${trashCount}개`);

      // 발견된 파일들을 휴지통으로 이동
      for (let i = 0; i < foundFiles.length; i++) {
        const fileInfo = foundFiles[i];
        try {
          const file = DriveApp.getFileById(fileInfo.id);
          file.setTrashed(true);
          console.log(`[PDF생성] 파일 휴지통 이동 성공: ${fileInfo.name} (ID: ${fileInfo.id})`);
        } catch (error) {
          console.log(`[PDF생성] 파일 휴지통 이동 실패: ${fileInfo.name} - ${error.message}`);
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

/********* PDF 생성 및 알림 *********/ // << 서명 완료 후 최종 PDF 생성 및 시트 삭제
function exportPdfAndNotify(row) {
  console.log(`[exportPdfAndNotify] 시작 - row: ${row}`);

  try {
    // << 1) PDF 생성 (기존 파일 휴지통 이동 후 새 파일 생성)
    console.log(`[exportPdfAndNotify] PDF 생성 시작 - row: ${row}`);
    const pdfFileId = createPdfFromSheet(row, true); // << moveOldToTrash = true
    console.log(`[exportPdfAndNotify] PDF 생성 완료 - fileId: ${pdfFileId}, row: ${row}`);

    // << 2) 시트 삭제 (존재 여부 재확인 후 삭제) - 성능 최적화: 배치 읽기
    const rowData = data().getRange(row, 19, 1, 1).getDisplayValues()[0];
    let sheetName = rowData[0].trim();
    console.log(`[exportPdfAndNotify] 삭제할 시트명: ${sheetName}, row: ${row}`);

    if (!sheetName) {
      console.log(`[exportPdfAndNotify] 시트명이 비어있음 - row: ${row}`);
      return;
    }

    // << 시트 존재 여부 재확인 (동시 삭제 방지)
    const sheet = ss.getSheetByName(sheetName);
    if (sheet) {
      try {
        // << 시트가 삭제 가능한지 확인 (최소 1개 시트는 남겨야 함)
        const allSheets = ss.getSheets();
        if (allSheets.length <= 1) {
          console.log(`[exportPdfAndNotify] 시트 삭제 불가 - 마지막 시트임, row: ${row}`);
          return;
        }

        ss.deleteSheet(sheet);
        console.log(`[exportPdfAndNotify] 시트 삭제 완료: ${sheetName}, row: ${row}`);

        // << 삭제 후 19열 초기화 (시트가 삭제되었으므로)
        data().getRange(row, 19).setValue('');
        SpreadsheetApp.flush();
        console.log(`[exportPdfAndNotify] 19열 초기화 완료 - row: ${row}`);
      } catch (deleteError) {
        console.log(
          `[exportPdfAndNotify] 시트 삭제 오류: ${deleteError.message}, sheetName: ${sheetName}, row: ${row}`
        );
        // << 시트 삭제 실패해도 프로세스 계속 진행
      }
    } else {
      console.log(`[exportPdfAndNotify] 삭제할 시트가 이미 없음: ${sheetName}, row: ${row}`);
    }

    console.log(`[exportPdfAndNotify] 완료 - row: ${row}`);
  } catch (error) {
    console.log(`[exportPdfAndNotify] 오류 발생 - row: ${row}, error: ${error.message}`);
    console.log(`[exportPdfAndNotify] 오류 스택: ${error.stack}`);
    throw error;
  }
}

function testExportPdf40() {
  // << 테스트용 PDF 생성 함수
  exportPdfAndNotify(18); // << 25행 테스트
}
