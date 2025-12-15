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

// << 성능 최적화: 전역 변수로 캐싱
const ss = SpreadsheetApp.getActive(); // << 현재 활성 스프레드시트 참조
const data = () => ss.getSheetByName(CFG.DATA); // << 데이터 시트 가져오는 함수
const tpl = () => ss.getSheetByName(CFG.TEMPLATE); // << 템플릿 시트 가져오는 함수
const out = msg => ContentService.createTextOutput(msg); // << 웹앱 응답 함수

// << 성능 최적화: 룩업 테이블 캐시
let boardLookupCache = new Map(); // << 보드 ID 캐시
let execUrlCache = new Map(); // << 실행 URL 캐시
let cacheTimestamp = 0; // << 캐시 타임스탬프
const CACHE_DURATION = 5 * 60 * 1000; // << 5분 캐시

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

/**
 * 주문 데이터로부터 기본 시트명 생성 (성능 최적화: 배치 읽기)
 */
function generateBaseName(row) {
  // << 성능 최적화: 한 번에 여러 컬럼 읽기
  const rowData = data().getRange(row, 3, 1, 10).getValues()[0]; // C~L열 배치 읽기

  const product = rowData[0].toString().trim(); // C열: 제품명 (인덱스 0)
  const weightVal = rowData[2].toString().trim(); // E열: 숫자 중량 (인덱스 2)
  const weight = `${weightVal}g`; // g 고정
  const expiryRaw = rowData[5]; // H열: 유통기한 (인덱스 5)
  const lot = rowData[6].toString().trim(); // I열: 로트 (인덱스 6)
  const line = rowData[9].toString().trim(); // L열: 주문자 (인덱스 9)

  const expiry = Utilities.formatDate(new Date(expiryRaw), Session.getScriptTimeZone(), 'yy.MM.dd');
  return `${line}_${product}_${expiry}_${lot}_${weight}`.replace(/[/\\?%*:|"<>]/g, '-');
}

/**
 * 행 데이터를 기반으로 시트명을 찾거나 생성
 */
function findOrCreateSheetName(row) {
  let sheetName = data().getRange(row, 15).getDisplayValue().trim(); // O열에서 uniqueName 읽기
  const baseName = generateBaseName(row);

  // O열이 비어있거나 해당 시트명이 존재하지 않으면 fallback 실행
  if (!sheetName || !ss.getSheetByName(sheetName)) {
    const shLatest = getLatestSheet(baseName); // 최근 시트 객체
    if (!shLatest) {
      return null; // 시트가 없음
    }
    sheetName = shLatest.getName();
    data().getRange(row, 15).setValue(sheetName); // fallback으로 찾은 시트 이름 O열에 기록
  }

  return sheetName;
}

/******** 1. 양식 제출 시 – 팀장 보드로 ********/ // << 폼 제출 트리거 부분 시작
function onFormSubmit(e) {
  const row = e.range.getRow(); // 이벤트 발생 행
  const status = data().getRange(row, 2).getValue().toString().trim(); // B열: 상태

  if (status === '작업 시작 시') {
    const baseName = generateBaseName(row);

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
    const sheetName = findOrCreateSheetName(row);
    if (!sheetName) return; // 시트가 없으면 종료

    const sh = ss.getSheetByName(sheetName);
    if (!sh) return; // 없으면 종료

    const mVals = sh.getRange('M10:M').getValues().flat(); // M10 이하 값
    const nextRow = 10 + mVals.filter(v => v !== '').length; // 다음 빈 M행 계산

    sh.getRange(`M${nextRow}`).setValue(data().getRange(row, 1).getValue()); // ▶ 타임스탬프 기록
    return;
  } else if (status === '제품생산 완료') {
    const sheetName = findOrCreateSheetName(row);
    if (!sheetName) return; // 시트가 없으면 종료

    const sh = ss.getSheetByName(sheetName);
    if (!sh) return; // 없으면 종료

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
  // << 동시 실행 방지를 위한 전역 Lock 적용
  const lock = LockService.getScriptLock();

  try {
    // << 30초 대기, 안정적인 순차 처리
    const lockAcquired = lock.tryLock(30000);
    if (!lockAcquired) {
      console.log(
        `[doGet] Lock 획득 실패 - 다른 서명 처리 중, 파라미터: ${JSON.stringify(e.parameter)}`
      );
      return out('busy - try again later');
    }
    console.log(`[doGet] Lock 획득 성공`);

    // << 처리 시작 시간 기록
    const startTime = new Date();

    console.log(`[doGet] 함수 호출됨 - 파라미터: ${JSON.stringify(e.parameter)}`);

    const role = e.parameter.role;
    const row = parseInt(e.parameter.row, 10);

    console.log(`[doGet] 파라미터 파싱 - role: ${role}, row: ${row}`);

    if (!role || !row) {
      console.log(`[doGet] 파라미터 오류 - role: ${role}, row: ${row}`);
      return out('param err');
    }

    console.log(`[doGet] 유효한 파라미터 확인됨`);

    if (role === 'leader') {
      console.log(`[doGet] 팀장 서명 처리 시작 - row: ${row}`);

      const leaderName = data().getRange(row, CFG.COL.CEO).getDisplayValue().trim();
      console.log(`[doGet] 팀장 이름: ${leaderName}`);

      // << 서명 삽입
      insertSig(row, CFG.COL.CEO_SIG, leaderName);
      SpreadsheetApp.flush();
      console.log(`[doGet] 서명 삽입 완료 - row: ${row}`);

      // << PDF 생성 및 시트 삭제 (에러 처리 강화)
      console.log(`[doGet] PDF 생성 및 시트 삭제 시작 - row: ${row}`);
      exportPdfAndNotify(row);
      console.log(`[doGet] PDF 생성 및 시트 삭제 완료 - row: ${row}`);

      // << 처리 완료 시간 계산 및 로깅
      const endTime = new Date();
      const processingTime = endTime - startTime;
      console.log(`[doGet] 모든 처리 완료 - row: ${row}, 처리시간: ${processingTime}ms`);
      return out('success');
    } else {
      console.log(`[doGet] 지원하지 않는 role: ${role}`);
      return out('invalid role');
    }
  } catch (error) {
    // << 에러 발생 시 상세 로깅
    console.log(`[doGet] 오류 발생 - row: ${e.parameter.row}, error: ${error.message}`);
    console.log(`[doGet] 오류 스택: ${error.stack}`);
    return out(`error: ${error.message}`);
  } finally {
    // << Lock 해제 (반드시 실행)
    if (lock) {
      lock.releaseLock();
      console.log(`[doGet] Lock 해제됨`);
    }
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
  const ts = new Date(); // A열 << 타임스탬프
  const docName = '1동 제품검수일지(대시보드)'; // B열  << 문서명       @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@

  // << 성능 최적화: 한 번에 필요한 데이터 읽기
  const sourceData = data().getRange(srcRow, 6, 1, 10).getValues()[0]; // F~O열 배치 읽기

  const vals = [
    ts,
    docName,
    sourceData[0], // F열 (인덱스 0)
    sourceData[9], // O열 (인덱스 9)
  ];
  sh.getRange(dstRow, 1, 1, 4).setValues([vals]).setNumberFormat('yyyy/MM/dd HH:mm:ss'); // << 쓰기 및 서식 적용

  // 2) 원본 행 번호 및 PDF 파일 ID (성능 최적화: 배치 쓰기)
  const metaData = [[srcRow], [null], [null], [null], [pdfFileId]]; // K, L, M, N, O열
  sh.getRange(dstRow, 11, 1, 5).setValues([metaData.flat()]); // << 배치 쓰기

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
function createPdfFromSheet(row, moveOldToTrash = false, customFolderId = null) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000); // << 동시 실행 방지, 안정적인 처리

  try {
    // ① O열(15)에 저장된 uniqueName 우선, 없으면 baseName으로 폴백하여 최신 시트 찾기
    const sheetName = findOrCreateSheetName(row);
    if (!sheetName) {
      throw new Error('시트를 찾을 수 없습니다');
    }

    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      throw new Error('시트를 찾을 수 없습니다: ' + sheetName);
    }

    // ② PDF URL 구성 및 Blob 생성 (성능 최적화: URL 캐싱)
    const baseUrl = ss.getUrl().replace(/\/edit$/, ''); // << 스프레드시트 기본 URL
    const gid = sheet.getSheetId(); // << 대상 시트 GID

    // << 성능 최적화: PDF URL 구성을 템플릿 리터럴로 최적화
    const pdfUrl = `${baseUrl}/export?format=pdf&gid=${gid}&size=A4&portrait=true&scale=4&top_margin=0.2&bottom_margin=0.2&left_margin=0.2&right_margin=0.2&gridlines=false&sheetnames=false&printtitle=false&horizontal_alignment=CENTER&vertical_alignment=MIDDLE&r1=0&r2=15&c1=0&c2=9`;

    // << 성능 최적화: OAuth 토큰 캐싱
    const oauthToken = ScriptApp.getOAuthToken();
    const blob = UrlFetchApp.fetch(pdfUrl, {
      headers: { Authorization: `Bearer ${oauthToken}` },
    }).getBlob();

    // ③ 파일명 설정
    const ts = data().getRange(row, 1).getValue(); // << A열: 타임스탬프
    const formatted = Utilities.formatDate(
      new Date(ts),
      Session.getScriptTimeZone(),
      'yyyy-MM-dd_HH:mm:ss'
    );
    const fileName = `1동 제품검수일지(대시보드)_${formatted}_${sheetName}.pdf`;
    blob.setName(fileName);

    // << 폴더 ID 결정: customFolderId가 있으면 사용, 없으면 기본 폴더 사용
    const folderId = customFolderId || CFG.PDF_FOLDER;
    const folder = DriveApp.getFolderById(folderId);

    // ④ 기존 파일 휴지통 이동 (서명 완료 시)
    if (moveOldToTrash) {
      console.log(`[PDF생성] 기존 파일 휴지통 이동 중: ${fileName}`);

      // << 기존 PDF는 항상 CFG.PDF_FOLDER(원본 폴더)에 있으므로 거기서 검색
      const originalFolder = DriveApp.getFolderById(CFG.PDF_FOLDER);

      // 원본 폴더 접근 권한 확인
      try {
        const originalFolderName = originalFolder.getName();
        console.log(`[PDF생성] 원본 폴더 접근 성공: ${originalFolderName}`);
      } catch (error) {
        console.log(`[PDF생성] 원본 폴더 접근 실패: ${error.message}`);
        return;
      }

      // 정확한 파일명 패턴으로 검색
      const filePrefix = '1동 제품검수일지(대시보드)_';
      const fileSuffix = `.pdf`;
      const searchPattern = `${filePrefix}*_${sheetName}${fileSuffix}`;
      console.log(`[PDF생성] 검색 패턴: ${searchPattern}`);

      const allFiles = originalFolder.getFiles();
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
      //`[PDF생성] 폴더 내 총 ${totalFiles}개 파일, 매칭 파일 ${trashCount}개`);

      // 발견된 파일들을 휴지통으로 이동
      for (let i = 0; i < foundFiles.length; i++) {
        const fileInfo = foundFiles[i];
        try {
          const file = DriveApp.getFileById(fileInfo.id);
          file.setTrashed(true);
          console.log(`[PDF생성] 파일 휴지통 이동 성공: ${fileInfo.name} (ID: ${fileInfo.id})`);
          //`[PDF생성] 파일 휴지통 이동 성공: ${fileInfo.name}`);
        } catch (error) {
          console.log(`[PDF생성] 파일 휴지통 이동 실패: ${fileInfo.name} - ${error.message}`);
          //`[PDF생성] 파일 휴지통 이동 실패: ${fileInfo.name} - ${error.message}`);
        }
      }

      console.log(`[PDF생성] 휴지통 이동 완료 - 총 ${trashCount}개 파일 처리`);
      //`[PDF생성] 휴지통 이동 완료 - 총 ${trashCount}개 파일 처리`);
    }

    // ⑤ 새 PDF 파일 생성
    const pdfFile = folder.createFile(blob);

    return pdfFile.getId(); // << PDF 파일 ID 반환
  } finally {
    lock.releaseLock(); // << 락 해제 (항상 실행)
  }
}

/********* 서명 완료 후 PDF 생성 및 시트 삭제 *********/ // << 최종 서명 후 처리
function exportPdfAndNotify(row) {
  console.log(`[exportPdfAndNotify] 시작 - row: ${row}`);

  try {
    // << 1) PDF 생성 (기존 파일 휴지통 이동 후 새 파일 생성, 새로운 폴더에 저장)
    console.log(`[exportPdfAndNotify] PDF 생성 시작 - row: ${row}`);
    const finalFolderId = '1LUi7lgAy3Uru4FbnB88hBxXIZ-Pb2NGE'; // << 최종 서명 PDF 저장 폴더
    const pdfFileId = createPdfFromSheet(row, true, finalFolderId);
    console.log(`[exportPdfAndNotify] PDF 생성 완료 - fileId: ${pdfFileId}, row: ${row}`);

    // << 2) 시트 삭제 (존재 여부 재확인 후 삭제) - 성능 최적화: 배치 읽기
    const rowData = data().getRange(row, 15, 1, 1).getDisplayValues()[0];
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

        // << O열 유니크네임은 삭제하지 않고 유지
        // data().getRange(row, 15).setValue(''); // 주석 처리: O열 유니크네임 유지
        SpreadsheetApp.flush();
        console.log(`[exportPdfAndNotify] 시트 삭제 완료, O열 유니크네임 유지 - row: ${row}`);
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
