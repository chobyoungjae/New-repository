function moveTimestamps() {
  try {
    const sheet1 = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('시트1');
    const viewSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('뷰');

    if (!sheet1 || !viewSheet) {
      Browser.msgBox('시트1 또는 뷰 시트를 찾을 수 없습니다.');
      return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    console.log('오늘 날짜:', today);

    const lastRow = sheet1.getLastRow();
    console.log('마지막 행:', lastRow);

    if (lastRow === 0) {
      Browser.msgBox('시트1에 데이터가 없습니다.');
      return;
    }

    // 원본 시리얼 넘버를 정확히 유지하기 위해 getDisplayValues()와 getValues() 병행 사용
    const timestampRange = sheet1.getRange('A1:A' + lastRow);
    const timestampData = timestampRange.getValues();
    const todayRows = []; // 오늘 날짜에 해당하는 행 번호 저장

    for (let i = 0; i < timestampData.length; i++) {
      const cellValue = timestampData[i][0];
      console.log(`행 ${i + 1}:`, cellValue);

      if (cellValue && (cellValue instanceof Date || typeof cellValue === 'string')) {
        let cellDate;

        if (cellValue instanceof Date) {
          cellDate = new Date(cellValue);
        } else if (typeof cellValue === 'string') {
          // 문자열에서 날짜 부분만 추출 (예: "2025.08.28 오후 03:06:15" -> "2025.08.28")
          const dateStr = cellValue.toString().split(' ')[0];
          console.log('추출된 날짜 문자열:', dateStr);

          // 점(.)을 슬래시(/)로 변경하여 Date 객체 생성
          const formattedDateStr = dateStr.replace(/\./g, '/');
          cellDate = new Date(formattedDateStr);

          if (isNaN(cellDate.getTime())) {
            console.log('유효하지 않은 날짜:', cellValue);
            continue;
          }
        }

        cellDate.setHours(0, 0, 0, 0);

        const todayStr = today.getFullYear() + '/' + (today.getMonth() + 1) + '/' + today.getDate();
        const cellDateStr =
          cellDate.getFullYear() + '/' + (cellDate.getMonth() + 1) + '/' + cellDate.getDate();

        console.log(`날짜 비교: ${cellDateStr} === ${todayStr}`);

        if (cellDate.getTime() === today.getTime()) {
          todayRows.push(i + 1); // 행 번호 저장 (1-based)
          console.log('매칭된 행 번호:', i + 1);
        }
      }
    }

    console.log('오늘 날짜 데이터 개수:', todayRows.length);

    viewSheet.getRange('B1:B11').clearContent();

    const maxRows = Math.min(todayRows.length, 11);
    if (maxRows > 0) {
      // 원본 셀을 직접 복사하여 부동소수점 오차 방지
      for (let i = 0; i < maxRows; i++) {
        const sourceCell = sheet1.getRange('A' + todayRows[i]);
        const targetCell = viewSheet.getRange('B' + (i + 1));
        sourceCell.copyTo(targetCell, SpreadsheetApp.CopyPasteType.PASTE_VALUES, false);
      }

      try {
        const result = transformViewToERP(); // DataTransformer.js의 함수 호출
        
        // 통합된 완료 메시지
        if (result && result.success) {
          Browser.msgBox(`✅ 완료!\n\n${maxRows}개의 데이터가 뷰시트와 ERP 시트로 변환 잘 되었습니다.`);
        } else if (result && !result.success) {
          Browser.msgBox(result.message || '변환 중 오류가 발생했습니다.');
        } else {
          Browser.msgBox(`✅ 완료!\n\n${maxRows}개의 데이터가 뷰시트와 ERP 시트로 변환 잘 되었습니다.`);
        }
        
      } catch (erpError) {
        console.error('ERP 변환 중 오류:', erpError);
        Browser.msgBox('ERP 변환 중 오류가 발생했습니다: ' + erpError.message);
      }
    } else {
      Browser.msgBox('오늘 날짜에 해당하는 데이터가 없습니다.');
    }
  } catch (error) {
    console.error('오류:', error);
    Browser.msgBox('오류가 발생했습니다: ' + error.message);
  }
}

function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('생산뷰').addItem('타임스템프 이동', 'moveTimestamps').addToUi();
}

// ========================= 웹훅 시스템 함수 =========================

/**
 * 로컬 Python 서버로 웹훅 신호 발송
 */
function sendWebhookTrigger(action, data) {
  try {
    console.log(`웹훅 발송 시작: ${action}`, data);
    
    const payload = {
      action: action,
      data: data,
      timestamp: new Date().toISOString(),
      spreadsheetId: SpreadsheetApp.getActiveSpreadsheet().getId()
    };
    
    // 로컬 Python 서버로 웹훅 발송
    const response = UrlFetchApp.fetch('http://localhost:5000/webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true // 오류 시에도 응답 받기
    });
    
    const responseCode = response.getResponseCode();
    const responseText = response.getContentText();
    
    if (responseCode === 200) {
      console.log('웹훅 발송 성공:', responseText);
      SpreadsheetApp.getActiveSpreadsheet().toast(
        '이카운트 자동 업로드를 시작합니다...', 
        '웹훅 전송 완료', 
        3
      );
    } else {
      throw new Error(`웹훅 서버 응답 오류: ${responseCode} - ${responseText}`);
    }
    
  } catch (error) {
    console.error('웹훅 발송 오류:', error);
    
    // Python 서버가 실행중이지 않은 경우 안내
    if (error.toString().includes('Connection refused') || error.toString().includes('network')) {
      SpreadsheetApp.getUi().alert(
        '웹훅 서버 연결 실패', 
        'Python 웹훅 서버가 실행중인지 확인해주세요.\n\n' +
        '서버 실행 방법:\n' +
        '1. Y:\\4000_생산(조병재)\\2025년\\ERP 생산등록2 자동\\ 폴더로 이동\n' +
        '2. python webhook_server.py 실행\n\n' +
        '현재는 ERP 변환까지만 완료되었습니다.',
        SpreadsheetApp.getUi().ButtonSet.OK
      );
    } else {
      SpreadsheetApp.getUi().alert('웹훅 오류', `웹훅 발송 중 오류:\n${error.message}`, SpreadsheetApp.getUi().ButtonSet.OK);
    }
  }
}

/**
 * VBA에서 호출할 수 있는 REST API (GET 방식)
 * 사용법: https://script.google.com/macros/s/[SCRIPT_ID]/exec?action=get_erp_data
 * 신규 액션: check_updates - 마지막 업데이트 이후 새 데이터 확인
 */
function doGet(e) {
  try {
    // 매개변수가 없는 경우 처리
    if (!e || !e.parameter) {
      return ContentService.createTextOutput(JSON.stringify({
        status: 'ok',
        message: '배합일지 API 서버가 정상 작동 중입니다.',
        timestamp: new Date().toISOString(),
        availableActions: ['get_erp_data', 'health_check']
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    const action = e.parameter.action;
    
    switch(action) {
      case 'get_erp_data':
        return getERPDataForVBA();
      
      case 'check_updates':
        return checkForUpdates(e.parameter.lastUpdate);
      
      case 'check_trigger':
        return checkTriggerFile();
      
      case 'health_check':
        return ContentService.createTextOutput(JSON.stringify({
          status: 'ok',
          timestamp: new Date().toISOString(),
          spreadsheetId: SpreadsheetApp.getActiveSpreadsheet().getId()
        })).setMimeType(ContentService.MimeType.JSON);
      
      default:
        return ContentService.createTextOutput(JSON.stringify({
          error: 'Invalid action',
          availableActions: ['get_erp_data', 'check_updates', 'check_trigger', 'health_check']
        })).setMimeType(ContentService.MimeType.JSON);
    }
    
  } catch (error) {
    console.error('API 요청 처리 오류:', error);
    return ContentService.createTextOutput(JSON.stringify({
      error: error.message,
      timestamp: new Date().toISOString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * ERP 시트 데이터를 VBA용 형식으로 반환
 */
function getERPDataForVBA() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const erpSheet = ss.getSheetByName('ERP');
  
  if (!erpSheet) {
    return ContentService.createTextOutput(JSON.stringify({
      error: 'ERP 시트를 찾을 수 없습니다.',
      data: []
    })).setMimeType(ContentService.MimeType.JSON);
  }
  
  const lastRow = erpSheet.getLastRow();
  
  if (lastRow <= 1) {
    return ContentService.createTextOutput(JSON.stringify({
      message: 'ERP 시트에 데이터가 없습니다.',
      data: []
    })).setMimeType(ContentService.MimeType.JSON);
  }
  
  // 헤더 제외하고 모든 데이터 가져오기 (2행부터)
  const dataRange = erpSheet.getRange(2, 1, lastRow - 1, 24); // A2:X까지
  const data = dataRange.getValues();
  
  // 이카운트용 형식으로 변환
  const iCountData = data.map(row => {
    return {
      date: formatDateForICount(row[0]),           // A열: 날짜
      author: row[2] || '',                       // C열: 작성자
      person: row[3] || '미쓰리',                   // D열: 담당자
      warehouse: row[4] || '불출창고',              // E열: 창고
      code: row[8] || '',                         // I열: 업체코드
      details: row[9] || '',                      // J열: 세부정보
      total: row[12] || 0,                        // M열: 총액
      bundleNumber: row[13] || '',                // N열: 묶음번호 (시트1 C열)
      itemCode: row[16] || '',                    // Q열: 품목코드
      itemName: row[17] || '',                    // R열: 품목명
      quantity: row[19] || 0,                     // T열: 수량
      price: row[22] || 0,                        // W열: 단가
      productNumber: row[23] || 0                 // X열: 제품별 번호
    };
  }).filter(item => item.itemCode && String(item.itemCode).trim() !== ''); // 품목코드가 있는 것만
  
  return ContentService.createTextOutput(JSON.stringify({
    status: 'success',
    dataCount: iCountData.length,
    timestamp: new Date().toISOString(),
    data: iCountData
  })).setMimeType(ContentService.MimeType.JSON);
}

/**
 * 업데이트 확인 - 마지막 업데이트 이후 새 데이터가 있는지 체크
 */
function checkForUpdates(lastUpdateTime) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const erpSheet = ss.getSheetByName('ERP');
    
    if (!erpSheet) {
      return ContentService.createTextOutput(JSON.stringify({
        hasUpdates: false,
        message: 'ERP 시트를 찾을 수 없습니다.',
        timestamp: new Date().toISOString()
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // ERP 시트의 마지막 수정 시간 확인
    const lastModified = DriveApp.getFileById(ss.getId()).getLastUpdated();
    
    // 마지막 업데이트 시간이 제공된 경우 비교
    if (lastUpdateTime) {
      const lastUpdate = new Date(lastUpdateTime);
      const hasNewData = lastModified > lastUpdate;
      
      return ContentService.createTextOutput(JSON.stringify({
        hasUpdates: hasNewData,
        lastModified: lastModified.toISOString(),
        lastChecked: lastUpdate.toISOString(),
        message: hasNewData ? '새 데이터가 있습니다.' : '새 데이터가 없습니다.',
        dataCount: erpSheet.getLastRow() - 1 // 헤더 제외
      })).setMimeType(ContentService.MimeType.JSON);
    } else {
      // 첫 실행인 경우
      return ContentService.createTextOutput(JSON.stringify({
        hasUpdates: true,
        lastModified: lastModified.toISOString(),
        message: '첫 실행 - 데이터를 가져옵니다.',
        dataCount: erpSheet.getLastRow() - 1
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
  } catch (error) {
    console.error('업데이트 확인 오류:', error);
    return ContentService.createTextOutput(JSON.stringify({
      hasUpdates: false,
      error: error.message,
      timestamp: new Date().toISOString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * 날짜를 이카운트 형식으로 변환
 */
function formatDateForICount(dateValue) {
  if (!dateValue) return '';
  
  try {
    let date;
    
    if (dateValue instanceof Date) {
      date = dateValue;
    } else if (typeof dateValue === 'string') {
      // YYYYMMDD 형식을 YYYY-MM-DD로 변환
      const str = String(dateValue);
      if (str.length === 8 && /^\d{8}$/.test(str)) {
        const year = str.substring(0, 4);
        const month = str.substring(4, 6);
        const day = str.substring(6, 8);
        return `${year}-${month}-${day}`;
      } else {
        date = new Date(dateValue);
      }
    }
    
    if (date && !isNaN(date.getTime())) {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    
    return String(dateValue);
    
  } catch (error) {
    console.error('날짜 변환 오류:', error);
    return String(dateValue);
  }
}

/**
 * Google Drive에 트리거 파일 생성
 */
function createTriggerFile() {
  try {
    const fileName = '배합일지_trigger.txt';
    const content = JSON.stringify({
      timestamp: new Date().toISOString(),
      spreadsheetId: SpreadsheetApp.getActiveSpreadsheet().getId(),
      action: 'update_excel',
      message: '엑셀 데이터 업데이트 요청'
    });
    
    // 기존 트리거 파일 삭제 (있다면)
    const existingFiles = DriveApp.getFilesByName(fileName);
    while (existingFiles.hasNext()) {
      existingFiles.next().setTrashed(true);
    }
    
    // 새 트리거 파일 생성
    const triggerFile = DriveApp.createFile(fileName, content, 'text/plain');
    
    console.log('트리거 파일 생성 완료:', triggerFile.getId());
    console.log('파일명:', fileName);
    
    return triggerFile.getId();
    
  } catch (error) {
    console.error('트리거 파일 생성 오류:', error);
    throw error;
  }
}

/**
 * VBA 즉시 실행 트리거 - 더 실용적인 접근
 */
function triggerVBADirectly() {
  try {
    // 트리거 파일 생성으로 VBA가 즉시 감지하도록 함
    const triggerId = createTriggerFile();
    
    // VBS 스크립트 - 줄바꿈 문제 해결
    const vbsScript = 'Option Explicit\r\n' +
      '\r\n' +
      'Dim objExcel, objWorkbook, objFSO\r\n' +
      'Dim excelFilePath\r\n' +
      '\r\n' +
      'Set objFSO = CreateObject("Scripting.FileSystemObject")\r\n' +
      'excelFilePath = "C:\\Users\\미쓰리\\Desktop\\ERP 생산등록2 자동\\배합일지_데이터.xlsx"\r\n' +
      '\r\n' +
      'If Not objFSO.FileExists(excelFilePath) Then\r\n' +
      '    WScript.Echo "엑셀 파일을 찾을 수 없습니다: " & excelFilePath\r\n' +
      '    WScript.Echo ""\r\n' +
      '    WScript.Echo "해결 방법:"\r\n' +
      '    WScript.Echo "1. ERP 생산등록2 자동 폴더에 배합일지_데이터.xlsx 파일 생성"\r\n' +
      '    WScript.Echo "2. VBA 코드 GoogleSheets_To_Excel.vba 추가"\r\n' +
      '    WScript.Echo "3. 매크로 보안 설정에서 모든 매크로 사용 선택"\r\n' +
      '    WScript.Quit 1\r\n' +
      'End If\r\n' +
      '\r\n' +
      'Set objExcel = CreateObject("Excel.Application")\r\n' +
      'objExcel.Visible = False\r\n' +
      'objExcel.DisplayAlerts = False\r\n' +
      '\r\n' +
      'On Error Resume Next\r\n' +
      '\r\n' +
      'Set objWorkbook = objExcel.Workbooks.Open(excelFilePath)\r\n' +
      '\r\n' +
      'If Err.Number <> 0 Then\r\n' +
      '    WScript.Echo "엑셀 파일 열기 실패: " & Err.Description\r\n' +
      '    objExcel.Quit\r\n' +
      '    Set objExcel = Nothing\r\n' +
      '    WScript.Quit 1\r\n' +
      'End If\r\n' +
      '\r\n' +
      'objExcel.Run "SmartImportFromGoogleSheets"\r\n' +
      '\r\n' +
      'If Err.Number = 0 Then\r\n' +
      '    WScript.Echo "VBA 실행 성공: 데이터 가져오기 완료"\r\n' +
      '    objWorkbook.Save\r\n' +
      '    WScript.Echo "업데이트 완료: 1_생산입고II 시트 확인"\r\n' +
      'Else\r\n' +
      '    WScript.Echo "VBA 실행 오류: " & Err.Description\r\n' +
      '    WScript.Echo "VBA 코드가 없거나 매크로 보안 설정을 확인하세요"\r\n' +
      'End If\r\n' +
      '\r\n' +
      'objWorkbook.Close False\r\n' +
      'objExcel.Quit\r\n' +
      'Set objWorkbook = Nothing\r\n' +
      'Set objExcel = Nothing\r\n' +
      'Set objFSO = Nothing\r\n' +
      '\r\n' +
      'WScript.Echo "작업 완료 - 엔터키를 눌러 종료하세요"\r\n' +
      'WScript.StdIn.ReadLine';
    
    // VBS 스크립트를 Google Drive에 저장
    const vbsFileName = '즉시실행_VBA.vbs';
    
    // 기존 VBS 파일 삭제
    const existingVbs = DriveApp.getFilesByName(vbsFileName);
    while (existingVbs.hasNext()) {
      existingVbs.next().setTrashed(true);
    }
    
    const vbsFile = DriveApp.createFile(vbsFileName, vbsScript, 'text/plain');
    
    console.log('VBS 스크립트 생성 완료:', vbsFile.getId());
    
    return {
      success: true,
      message: 'VBS 실행 스크립트가 생성되었습니다. Google Drive에서 다운로드 후 실행하세요.',
      triggerId: triggerId,
      vbsFileId: vbsFile.getId(),
      instructions: [
        '1. Google Drive에서 "즉시실행_VBA.vbs" 파일 다운로드',
        '2. 다운로드한 VBS 파일을 더블클릭하여 실행',
        '3. 엑셀 데이터가 자동으로 업데이트됩니다'
      ]
    };
    
  } catch (error) {
    console.error('VBA 트리거 생성 오류:', error);
    return {
      success: false,
      message: error.message
    };
  }
}

/**
 * 트리거 파일 확인 (VBA에서 호출)
 */
function checkTriggerFile() {
  try {
    const fileName = '배합일지_trigger.txt';
    const files = DriveApp.getFilesByName(fileName);
    
    if (files.hasNext()) {
      const file = files.next();
      const fileContent = file.getBlob().getDataAsString();
      
      // 파일 삭제 (한 번만 처리되도록)
      file.setTrashed(true);
      
      return ContentService.createTextOutput(JSON.stringify({
        hasTrigger: true,
        triggerData: JSON.parse(fileContent),
        message: '트리거 파일 발견 - 데이터 업데이트 진행',
        timestamp: new Date().toISOString()
      })).setMimeType(ContentService.MimeType.JSON);
    } else {
      return ContentService.createTextOutput(JSON.stringify({
        hasTrigger: false,
        message: '트리거 파일 없음 - 대기',
        timestamp: new Date().toISOString()
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
  } catch (error) {
    console.error('트리거 파일 확인 오류:', error);
    return ContentService.createTextOutput(JSON.stringify({
      hasTrigger: false,
      error: error.message,
      timestamp: new Date().toISOString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}
