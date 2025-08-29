/**
 * 배합일지 데이터 변환 시스템
 * Google Sheets "뷰" 시트의 8개 테이블을 "ERP" 시트로 변환
 * @author Assistant
 * @version 1.0
 */

// ========================= 설정 상수 =========================

const CONFIG = {
  SHEETS: {
    VIEW: '뷰',
    ERP: 'ERP'
  },
  
  // 8개 테이블의 위치 정의 (2x4 격자)
  TABLE_RANGES: [
    { startRow: 12, startCol: 1 },  // A12 (테이블 1)
    { startRow: 12, startCol: 7 },  // G12 (테이블 2)
    { startRow: 12, startCol: 13 }, // M12 (테이블 3)
    { startRow: 12, startCol: 19 }, // S12 (테이블 4)
    { startRow: 39, startCol: 1 },  // A39 (테이블 5)
    { startRow: 39, startCol: 7 },  // G39 (테이블 6)
    { startRow: 39, startCol: 13 }, // M39 (테이블 7)
    { startRow: 39, startCol: 19 }  // S39 (테이블 8)
  ],
  
  // 테이블 크기
  TABLE_SIZE: {
    ROWS: 26,  // 전체 행 수
    COLS: 5,   // 전체 열 수
    DATA_START_ROW: 11,  // 품목 데이터 시작 행 (B22, 상대 위치 11)
    DATA_END_ROW: 25,    // 품목 데이터 종료 행 (B36, 상대 위치 25)
  },
  
  // 매핑 규칙 (상대 위치)
  MAPPING: {
    HEADER: {
      TIMESTAMP: { row: 3, col: 3 },   // C14 (상대위치: 3행 3열)
      CODE: { row: 4, col: 3 },        // C15 (상대위치: 4행 3열)
      DETAILS: { row: 5, col: 3 },     // C16 (상대위치: 5행 3열)
      TOTAL: { row: 8, col: 3 }        // C19 (상대위치: 8행 3열)
    },
    ITEMS: {
      CODE: 2,      // B열 (품목코드)
      NAME: 3,      // C열 (품목명)
      QUANTITY: 4,  // D열 (수량)
      PRICE: 5      // E열 (단가)
    }
  },
  
  // ERP 시트 열 매핑 (1-based index)
  ERP_COLUMNS: {
    TIMESTAMP: 1,    // A열
    PERSON: 4,       // D열 (미쓰리)
    WAREHOUSE: 5,    // E열 (불출창고)
    CODE: 9,         // I열
    DETAILS: 10,     // J열
    TOTAL: 13,       // M열
    ITEM_CODE: 17,   // Q열
    ITEM_NAME: 18,   // R열
    QUANTITY: 20,    // T열
    PRICE: 23        // W열
  },
  
  // 고정값
  FIXED_VALUES: {
    PERSON: '미쓰리',
    WAREHOUSE: '불출창고'
  }
};

// ========================= 메인 함수 =========================

/**
 * 뷰 시트의 데이터를 ERP 시트로 변환하는 메인 함수
 */
function transformViewToERP() {
  const startTime = new Date();
  console.log('=== 데이터 변환 시작 ===');
  
  try {
    // 스프레드시트 및 시트 가져오기
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const viewSheet = ss.getSheetByName(CONFIG.SHEETS.VIEW);
    const erpSheet = ss.getSheetByName(CONFIG.SHEETS.ERP);
    
    // 시트 존재 확인
    if (!viewSheet || !erpSheet) {
      throw new Error('필요한 시트를 찾을 수 없습니다. "뷰"와 "ERP" 시트가 있는지 확인하세요.');
    }
    
    // 진행 상황 표시
    SpreadsheetApp.getActiveSpreadsheet().toast('데이터 변환을 시작합니다...', '처리 중', 3);
    
    // ERP 시트 초기화 (헤더 제외하고 삭제)
    clearERPSheet(erpSheet);
    
    // 모든 테이블 데이터 수집
    const allTableData = collectAllTableData(viewSheet);
    
    // ERP 형식으로 변환
    const erpData = transformToERPFormat(allTableData);
    
    // ERP 시트에 데이터 입력
    if (erpData.length > 0) {
      writeToERPSheet(erpSheet, erpData);
      
      const endTime = new Date();
      const processingTime = ((endTime - startTime) / 1000).toFixed(2);
      
      // 완료 메시지
      const message = `✅ 변환 완료!\n\n처리된 데이터: ${erpData.length}행\n처리 시간: ${processingTime}초`;
      SpreadsheetApp.getUi().alert('성공', message, SpreadsheetApp.getUi().ButtonSet.OK);
      console.log(`변환 완료: ${erpData.length}행 처리, ${processingTime}초 소요`);
    } else {
      SpreadsheetApp.getUi().alert('알림', '변환할 데이터가 없습니다.', SpreadsheetApp.getUi().ButtonSet.OK);
    }
    
  } catch (error) {
    console.error('변환 중 오류 발생:', error);
    SpreadsheetApp.getUi().alert('오류', `데이터 변환 중 오류가 발생했습니다:\n${error.message}`, 
                                 SpreadsheetApp.getUi().ButtonSet.OK);
  }
}

// ========================= 데이터 수집 함수 =========================

/**
 * 모든 테이블에서 데이터 수집
 */
function collectAllTableData(viewSheet) {
  const allData = [];
  
  CONFIG.TABLE_RANGES.forEach((table, index) => {
    console.log(`테이블 ${index + 1} 처리 중...`);
    
    try {
      const tableData = extractTableData(viewSheet, table.startRow, table.startCol, index + 1);
      
      if (tableData && tableData.items.length > 0) {
        allData.push(tableData);
        console.log(`  → ${tableData.items.length}개 품목 발견`);
      } else {
        console.log(`  → 데이터 없음 (건너뛰기)`);
      }
    } catch (error) {
      console.error(`테이블 ${index + 1} 처리 중 오류:`, error);
    }
  });
  
  console.log(`총 ${allData.length}개 테이블에서 데이터 수집 완료`);
  return allData;
}

/**
 * 개별 테이블에서 데이터 추출
 */
function extractTableData(sheet, startRow, startCol, tableNumber) {
  // 전체 테이블 범위 가져오기
  const range = sheet.getRange(startRow, startCol, CONFIG.TABLE_SIZE.ROWS, CONFIG.TABLE_SIZE.COLS);
  const values = range.getValues();
  
  // #N/A 오류 체크 함수
  const isValidValue = (value) => {
    if (!value && value !== 0) return false;
    const strValue = String(value).toUpperCase();
    return strValue !== '#N/A' && strValue !== '#ERROR!' && strValue !== '#REF!' && 
           strValue !== '#DIV/0!' && strValue !== '#VALUE!' && strValue !== '#NAME?' && 
           strValue !== '#NUM!' && strValue !== '#NULL!';
  };
  
  // 헤더 정보 추출 (#N/A 체크 포함)
  const headerTimestamp = values[CONFIG.MAPPING.HEADER.TIMESTAMP.row - 1][CONFIG.MAPPING.HEADER.TIMESTAMP.col - 1];
  const headerCode = values[CONFIG.MAPPING.HEADER.CODE.row - 1][CONFIG.MAPPING.HEADER.CODE.col - 1];
  const headerDetails = values[CONFIG.MAPPING.HEADER.DETAILS.row - 1][CONFIG.MAPPING.HEADER.DETAILS.col - 1];
  const headerTotal = values[CONFIG.MAPPING.HEADER.TOTAL.row - 1][CONFIG.MAPPING.HEADER.TOTAL.col - 1];
  
  const header = {
    timestamp: isValidValue(headerTimestamp) ? headerTimestamp : '',
    code: isValidValue(headerCode) ? headerCode : '',
    details: isValidValue(headerDetails) ? headerDetails : '',
    total: isValidValue(headerTotal) ? headerTotal : 0
  };
  
  // 품목 데이터 추출
  const items = [];
  
  for (let i = CONFIG.TABLE_SIZE.DATA_START_ROW - 1; i <= CONFIG.TABLE_SIZE.DATA_END_ROW - 1; i++) {
    const itemCode = values[i][CONFIG.MAPPING.ITEMS.CODE - 1];
    const itemName = values[i][CONFIG.MAPPING.ITEMS.NAME - 1];
    const quantity = values[i][CONFIG.MAPPING.ITEMS.QUANTITY - 1];
    const price = values[i][CONFIG.MAPPING.ITEMS.PRICE - 1];
    
    // 품목코드가 있고 #N/A 오류가 아닌 경우만 처리
    if (itemCode && String(itemCode).trim() !== '' && isValidValue(itemCode)) {
      items.push({
        code: itemCode,
        name: isValidValue(itemName) ? itemName : '',
        quantity: isValidValue(quantity) ? quantity : 0,
        price: isValidValue(price) ? price : 0
      });
    }
  }
  
  // 데이터가 있는 경우만 반환
  if (items.length > 0) {
    return {
      tableNumber: tableNumber,
      header: header,
      items: items
    };
  }
  
  return null;
}

// ========================= 데이터 변환 함수 =========================

/**
 * 수집된 데이터를 ERP 형식으로 변환
 */
function transformToERPFormat(allTableData) {
  const erpRows = [];
  
  allTableData.forEach(tableData => {
    const { header, items } = tableData;
    
    // 타임스탬프 변환 (YYYYMMDD 형식)
    const formattedTimestamp = formatTimestamp(header.timestamp);
    
    // 각 품목에 대해 행 생성
    items.forEach(item => {
      const row = new Array(23).fill(''); // W열(23)까지
      
      // 헤더 정보 (반복)
      row[CONFIG.ERP_COLUMNS.TIMESTAMP - 1] = formattedTimestamp;
      row[CONFIG.ERP_COLUMNS.PERSON - 1] = CONFIG.FIXED_VALUES.PERSON;      // D열: 미쓰리
      row[CONFIG.ERP_COLUMNS.WAREHOUSE - 1] = CONFIG.FIXED_VALUES.WAREHOUSE; // E열: 불출창고
      row[CONFIG.ERP_COLUMNS.CODE - 1] = header.code;
      row[CONFIG.ERP_COLUMNS.DETAILS - 1] = header.details;
      row[CONFIG.ERP_COLUMNS.TOTAL - 1] = header.total;
      
      // 품목 정보
      row[CONFIG.ERP_COLUMNS.ITEM_CODE - 1] = item.code;
      row[CONFIG.ERP_COLUMNS.ITEM_NAME - 1] = item.name;
      row[CONFIG.ERP_COLUMNS.QUANTITY - 1] = item.quantity;
      row[CONFIG.ERP_COLUMNS.PRICE - 1] = item.price;
      
      erpRows.push(row);
    });
  });
  
  return erpRows;
}

/**
 * 타임스탬프를 YYYYMMDD 형식으로 변환
 */
function formatTimestamp(timestamp) {
  if (!timestamp) return '';
  
  try {
    let date;
    
    // Date 객체인 경우
    if (timestamp instanceof Date) {
      date = timestamp;
    } 
    // 문자열인 경우 (예: "2025.08.28 오후 03:06:15")
    else if (typeof timestamp === 'string') {
      // 날짜 부분만 추출
      const datePart = timestamp.split(' ')[0];
      if (datePart && datePart.includes('.')) {
        const [year, month, day] = datePart.split('.');
        date = new Date(year, month - 1, day);
      } else {
        return timestamp; // 변환 실패시 원본 반환
      }
    } else {
      return String(timestamp);
    }
    
    // YYYYMMDD 형식으로 포맷
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    return `${year}${month}${day}`;
    
  } catch (error) {
    console.error('타임스탬프 변환 오류:', error);
    return String(timestamp); // 오류시 원본 문자열 반환
  }
}

// ========================= 시트 작업 함수 =========================

/**
 * ERP 시트 초기화 (헤더 제외하고 모든 데이터 삭제)
 */
function clearERPSheet(erpSheet) {
  const lastRow = erpSheet.getLastRow();
  
  if (lastRow > 1) {
    // 2행부터 마지막 행까지 삭제
    erpSheet.deleteRows(2, lastRow - 1);
    console.log(`ERP 시트 초기화: ${lastRow - 1}행 삭제`);
  }
}

/**
 * ERP 시트에 데이터 쓰기
 */
function writeToERPSheet(erpSheet, data) {
  if (data.length === 0) return;
  
  // 데이터를 한 번에 쓰기 (성능 최적화)
  const range = erpSheet.getRange(2, 1, data.length, data[0].length);
  range.setValues(data);
  
  console.log(`ERP 시트에 ${data.length}행 입력 완료`);
  
  // 포맷 적용
  applyERPFormatting(erpSheet, data.length);
}

/**
 * ERP 시트 포맷 적용
 */
function applyERPFormatting(erpSheet, rowCount) {
  // 숫자 열에 숫자 포맷 적용
  const numberColumns = [
    CONFIG.ERP_COLUMNS.TOTAL,
    CONFIG.ERP_COLUMNS.QUANTITY,
    CONFIG.ERP_COLUMNS.PRICE
  ];
  
  numberColumns.forEach(col => {
    const range = erpSheet.getRange(2, col, rowCount, 1);
    range.setNumberFormat('#,##0');
  });
  
  // 타임스탬프 열 중앙 정렬
  const timestampRange = erpSheet.getRange(2, CONFIG.ERP_COLUMNS.TIMESTAMP, rowCount, 1);
  timestampRange.setHorizontalAlignment('center');
}

// ========================= 메뉴 통합 함수 =========================

/**
 * 기존 메뉴에 새 기능 추가 (이 함수는 기존 Code.js의 onOpen에서 호출)
 */
function addTransformMenuItem() {
  const ui = SpreadsheetApp.getUi();
  const menu = ui.createMenu('생산뷰');
  
  menu.addItem('타임스템프 이동', 'moveTimestamps')
      .addSeparator()
      .addItem('📊 ERP 데이터 변환', 'transformViewToERP')
      .addItem('ℹ️ 변환 기능 도움말', 'showTransformHelp')
      .addToUi();
}

/**
 * 도움말 표시
 */
function showTransformHelp() {
  const helpText = `
📊 ERP 데이터 변환 기능 안내

이 기능은 "뷰" 시트의 8개 테이블을 "ERP" 시트의 행 형식으로 자동 변환합니다.

📍 처리 대상:
• 2x4 격자로 배열된 8개 테이블
• 각 테이블의 헤더 정보와 품목 데이터

⚙️ 변환 규칙:
• 타임스탬프 → YYYYMMDD 형식
• 헤더 정보는 품목 수만큼 반복
• 빈 테이블은 자동으로 건너뜀

⚠️ 주의사항:
• 기존 ERP 데이터는 모두 삭제됩니다
• 실행 전 백업을 권장합니다

📝 필요한 시트:
• "뷰" 시트 (원본 데이터)
• "ERP" 시트 (변환 결과)
  `;
  
  SpreadsheetApp.getUi().alert('도움말', helpText, SpreadsheetApp.getUi().ButtonSet.OK);
}

// ========================= 유틸리티 함수 =========================

/**
 * 디버그 로그 출력 (개발시 사용)
 */
function debugLog(message, data) {
  if (typeof DEBUG !== 'undefined' && DEBUG) {
    console.log(`[DEBUG] ${message}`, data || '');
  }
}

/**
 * 처리 진행률 표시
 */
function showProgress(current, total, message) {
  const percentage = Math.round((current / total) * 100);
  SpreadsheetApp.getActiveSpreadsheet().toast(
    `${message} (${current}/${total} - ${percentage}%)`,
    '처리 중',
    1
  );
}

// ========================= 테스트 함수 =========================

/**
 * 개발/테스트용 함수 - 단일 테이블 테스트
 */
function testSingleTable() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const viewSheet = ss.getSheetByName(CONFIG.SHEETS.VIEW);
  
  // 첫 번째 테이블만 테스트
  const tableData = extractTableData(viewSheet, 12, 1, 1);
  console.log('테스트 결과:', JSON.stringify(tableData, null, 2));
}

/**
 * 설정 확인용 함수
 */
function checkConfiguration() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const viewSheet = ss.getSheetByName(CONFIG.SHEETS.VIEW);
  const erpSheet = ss.getSheetByName(CONFIG.SHEETS.ERP);
  
  const status = {
    '뷰 시트': viewSheet ? '✅ 존재' : '❌ 없음',
    'ERP 시트': erpSheet ? '✅ 존재' : '❌ 없음',
    '테이블 수': CONFIG.TABLE_RANGES.length,
    '매핑 설정': '완료'
  };
  
  console.log('시스템 설정 확인:', status);
  return status;
}