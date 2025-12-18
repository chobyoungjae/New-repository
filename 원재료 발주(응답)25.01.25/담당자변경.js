/**
 * 구역별 담당자 자동 변경 시스템
 *
 * 설문지 제출 시 해당 구역의 담당자를 일괄 변경합니다.
 * - 배합실 담당자 시트 → 해당거래처 L열="배합실"인 행의 I열 변경
 * - 컵떡장 담당자 시트 → 해당거래처 L열="컵떡장"인 행의 I열 변경
 * - 외포장실 담당자 시트 → 해당거래처 L열="외포장실"인 행의 I열 변경
 *
 * 트리거 설정: onFormSubmit (스프레드시트 트리거)
 */

// 구역-시트 매핑 설정
const ZONE_CONFIG = {
  '배합실 담당자': '배합실',
  '컵떡장 담당자': '컵떡장',
  '외포장실 담당자': '외포장실'
};

// 대상 시트 및 열 설정
const TARGET_SHEET_NAME = '해당거래처';
const ZONE_COLUMN = 12;      // L열: 구역명
const MANAGER_COLUMN = 9;    // I열: 담당자명

/**
 * 설문 제출 트리거 함수
 * Google Forms 응답이 스프레드시트에 기록될 때 자동 실행
 *
 * @param {GoogleAppsScript.Events.SheetsOnFormSubmit} e - 폼 제출 이벤트 객체
 */
function onFormSubmitUpdateManager(e) {
  try {
    // 이벤트 객체 검증
    if (!e || !e.range) {
      Logger.log('❌ 이벤트 객체가 없습니다.');
      return;
    }

    const sheet = e.range.getSheet();
    const sheetName = sheet.getName();

    // 대상 시트인지 확인
    const zoneName = ZONE_CONFIG[sheetName];
    if (!zoneName) {
      Logger.log('ℹ️ 대상 시트가 아닙니다: ' + sheetName);
      return;
    }

    // 응답 데이터에서 담당자명 추출 (B열 = 2번째 열)
    const row = e.range.getRow();
    const managerName = sheet.getRange(row, 2).getValue();

    if (!managerName || String(managerName).trim() === '') {
      Logger.log('⚠️ 담당자명이 비어있습니다. 시트: ' + sheetName + ', 행: ' + row);
      return;
    }

    Logger.log('📋 담당자 변경 시작 - 구역: ' + zoneName + ', 담당자: ' + managerName);

    // 해당거래처 시트에서 담당자 일괄 변경
    const updatedCount = updateManagerInTargetSheet(zoneName, managerName);

    Logger.log('✅ 담당자 변경 완료 - ' + updatedCount + '개 행 업데이트됨');

  } catch (error) {
    Logger.log('❌ 오류 발생: ' + error.toString());
    Logger.log('스택: ' + error.stack);
  }
}

/**
 * 해당거래처 시트에서 특정 구역의 담당자를 일괄 변경
 *
 * @param {string} zoneName - 구역명 (배합실/컵떡장/외포장실)
 * @param {string} managerName - 변경할 담당자명
 * @returns {number} 변경된 행 수
 */
function updateManagerInTargetSheet(zoneName, managerName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const targetSheet = ss.getSheetByName(TARGET_SHEET_NAME);

  if (!targetSheet) {
    Logger.log('❌ ' + TARGET_SHEET_NAME + ' 시트를 찾을 수 없습니다.');
    return 0;
  }

  // Lock을 사용하여 동시 접근 방지
  const lock = LockService.getDocumentLock();
  let lockAcquired = false;
  let updatedCount = 0;

  try {
    lockAcquired = lock.tryLock(10000); // 10초 대기
    if (!lockAcquired) {
      Logger.log('⚠️ Lock 획득 실패 - 다른 프로세스가 실행 중');
      return 0;
    }

    const lastRow = targetSheet.getLastRow();
    if (lastRow < 2) {
      Logger.log('ℹ️ 데이터가 없습니다.');
      return 0;
    }

    // L열(구역) 데이터 전체 가져오기
    const zoneData = targetSheet.getRange(2, ZONE_COLUMN, lastRow - 1, 1).getValues();

    // 변경할 행 목록 수집
    const rowsToUpdate = [];
    for (let i = 0; i < zoneData.length; i++) {
      const cellValue = String(zoneData[i][0]).trim();
      if (cellValue === zoneName) {
        rowsToUpdate.push(i + 2); // 실제 행 번호 (헤더 제외하고 2부터 시작)
      }
    }

    // 일괄 업데이트 (성능 최적화)
    if (rowsToUpdate.length > 0) {
      // 연속된 범위로 묶어서 처리 (성능 향상)
      for (const rowNum of rowsToUpdate) {
        targetSheet.getRange(rowNum, MANAGER_COLUMN).setValue(managerName);
      }
      updatedCount = rowsToUpdate.length;

      // 변경사항 즉시 반영
      SpreadsheetApp.flush();
    }

    Logger.log('📊 구역 [' + zoneName + '] - 총 ' + updatedCount + '개 행 업데이트');

  } finally {
    if (lockAcquired) {
      lock.releaseLock();
    }
  }

  return updatedCount;
}

/**
 * 수동 테스트용 함수
 * Apps Script 에디터에서 직접 실행하여 동작 확인
 *
 * 사용법:
 * 1. Apps Script 에디터에서 이 함수 선택
 * 2. 실행 버튼 클릭
 * 3. 로그 확인 (Ctrl+Enter 또는 보기 > 로그)
 */
function testUpdateManager() {
  // 테스트할 구역과 담당자명 설정
  const testZone = '배합실';
  const testManager = '테스트담당자';

  Logger.log('🧪 테스트 시작 - 구역: ' + testZone + ', 담당자: ' + testManager);

  const count = updateManagerInTargetSheet(testZone, testManager);

  Logger.log('🧪 테스트 완료 - ' + count + '개 행 업데이트됨');
}

/**
 * 현재 담당자 현황 조회 함수
 * 각 구역별 담당자가 몇 명의 거래처를 담당하는지 확인
 */
function checkManagerStatus() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const targetSheet = ss.getSheetByName(TARGET_SHEET_NAME);

  if (!targetSheet) {
    Logger.log('❌ ' + TARGET_SHEET_NAME + ' 시트를 찾을 수 없습니다.');
    return;
  }

  const lastRow = targetSheet.getLastRow();
  if (lastRow < 2) {
    Logger.log('ℹ️ 데이터가 없습니다.');
    return;
  }

  // I열(담당자), L열(구역) 데이터 가져오기
  const data = targetSheet.getRange(2, 1, lastRow - 1, ZONE_COLUMN).getValues();

  // 구역별 담당자 집계
  const stats = {};
  for (const row of data) {
    const manager = String(row[MANAGER_COLUMN - 1]).trim();
    const zone = String(row[ZONE_COLUMN - 1]).trim();

    if (!zone) continue;

    if (!stats[zone]) {
      stats[zone] = { total: 0, managers: {} };
    }
    stats[zone].total++;

    if (manager) {
      if (!stats[zone].managers[manager]) {
        stats[zone].managers[manager] = 0;
      }
      stats[zone].managers[manager]++;
    }
  }

  // 결과 출력
  Logger.log('📊 ========== 담당자 현황 ==========');
  for (const zone in stats) {
    Logger.log('');
    Logger.log('🏭 [' + zone + '] 총 ' + stats[zone].total + '개 거래처');
    for (const manager in stats[zone].managers) {
      Logger.log('   👤 ' + manager + ': ' + stats[zone].managers[manager] + '개');
    }
  }
  Logger.log('=====================================');
}
