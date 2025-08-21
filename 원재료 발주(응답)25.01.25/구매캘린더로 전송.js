// 전역 실행 큐를 관리하는 객체
var executionQueue = executionQueue || [];
var isProcessing = isProcessing || false;

function moveToBuyCalendar(e) {
  var sheet = e.range.getSheet();
  var sheetName = sheet.getName();
  var row = e.range.getRow();
  var col = e.range.getColumn();
  var value = e.value;

  var 원시트 = ['부재료(박스)', '부재료(포장지)', '원재료'];
  if (원시트.indexOf(sheetName) === -1 || col !== 14 || value !== '발주완료') return;

  // 실행 큐에 작업 추가
  var taskData = {
    sheetName: sheetName,
    row: row,
    timestamp: new Date().getTime(),
    uniqueId: Utilities.getUuid(),
  };

  executionQueue.push(taskData);

  // 큐 처리 시작 (중복 실행 방지)
  if (!isProcessing) {
    processQueue();
  }
}

function processQueue() {
  if (executionQueue.length === 0) {
    isProcessing = false;
    return;
  }

  isProcessing = true;

  try {
    // 큐에서 가장 오래된 작업 가져오기
    var task = executionQueue.shift();
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(task.sheetName);

    if (!sheet) {
      console.log('시트를 찾을 수 없음: ' + task.sheetName);
      processNextInQueue();
      return;
    }

    // 해당 셀이 아직 '발주완료' 상태인지 확인 (다른 사용자가 변경했을 수 있음)
    var currentValue = sheet.getRange(task.row, 14).getValue();
    if (currentValue !== '발주완료') {
      console.log('값이 변경됨. 처리 건너뛰기');
      processNextInQueue();
      return;
    }

    // 구매 캘린더 시트 확인
    var 구매캘린더 = ss.getSheetByName('구매 캘린더');
    if (!구매캘린더) {
      console.log('구매 캘린더 시트가 없습니다!');
      processNextInQueue();
      return;
    }

    // 중복 처리 방지: 이미 처리된 데이터인지 확인
    var rowData = sheet.getRange(task.row, 1, 1, 15).getValues()[0];
    var 코드번호 = rowData[7]; // H열 코드번호
    var 상품명 = rowData[4]; // E열 상품명

    // 구매 캘린더에서 같은 코드번호와 상품명이 최근 3초 이내에 추가되었는지 확인
    var 구매데이터 = 구매캘린더.getDataRange().getValues();
    var 현재시간 = new Date();
    var 중복체크시간 = 3 * 1000; // 3초

    for (var i = 구매데이터.length - 1; i >= 1 && i >= 구매데이터.length - 10; i--) {
      var 기존코드 = 구매데이터[i][3]; // D열
      var 기존상품 = 구매데이터[i][1]; // B열
      var 기존타임스탬프 = 구매데이터[i][0]; // A열

      if (기존코드 == 코드번호 && 기존상품 == 상품명) {
        if (기존타임스탬프 instanceof Date) {
          var 시간차이 = 현재시간.getTime() - 기존타임스탬프.getTime();
          if (시간차이 < 중복체크시간) {
            console.log('중복 데이터 발견. 처리 건너뛰기: ' + 시간차이 + 'ms 차이');
            processNextInQueue();
            return;
          }
        }
      }
    }

    var I열값 = task.sheetName === '원재료' ? '노랑' : '핑크';

    var timeString = Utilities.formatDate(현재시간, 'Asia/Seoul', 'yyyy. M. d a h:mm:ss')
      .replace('AM', '오전')
      .replace('PM', '오후');

    var newRow = [
      timeString, // A열: 타임스탬프
      rowData[4], // B열: E열 (상품명)
      '', // C열: (비움)
      rowData[7], // D열: H열 (코드번호)
      rowData[8], // E열: I열 (원시트의 I열 값)
      rowData[5], // F열: F열
      rowData[3], // G열: D열
      '', // H열: (비움)
      I열값, // I열: 노랑/핑크 (시트별)
    ];

    // Lock을 사용하여 동시 접근 방지
    var lock = LockService.getDocumentLock();
    var lockAcquired = false;

    try {
      lockAcquired = lock.tryLock(10000); // 10초 대기
      if (!lockAcquired) {
        throw new Error('Lock 획득 실패');
      }

      // 다시 한번 마지막 행 확인 (Lock 이후)
      var lastDataRow = 구매캘린더.getRange('A:A').getValues().filter(String).length;
      var targetRow = lastDataRow + 1;

      // 데이터 추가
      구매캘린더.getRange(targetRow, 1, 1, newRow.length).setValues([newRow]);

      // --- L열(12번째)에 체크박스 조건 처리 ---
      var 거래처시트 = null;
      try {
        거래처시트 = ss.getSheetByName('해당거래처');
      } catch (err) {
        거래처시트 = null;
      }

      var needCheckbox = false;
      if (거래처시트) {
        var 거래처Data = 거래처시트.getDataRange().getValues();
        for (var j = 1; j < 거래처Data.length; j++) {
          if (
            String(거래처Data[j][1]).trim() == String(코드번호).trim() &&
            String(거래처Data[j][10]).trim() == '선입금'
          ) {
            needCheckbox = true;
            break;
          }
        }
      }

      if (needCheckbox) {
        var lCell = 구매캘린더.getRange(targetRow, 12); // L열(12번째)
        lCell.insertCheckboxes();
        lCell.setValue(false);
      }

      console.log('데이터 처리 완료: ' + task.sheetName + ' 행 ' + task.row);
    } catch (error) {
      console.log('데이터 처리 중 오류: ' + error.toString());
      // 실패한 작업을 큐 뒤쪽에 다시 추가 (재시도)
      if (!task.retryCount) task.retryCount = 0;
      if (task.retryCount < 3) {
        task.retryCount++;
        executionQueue.push(task);
        console.log('재시도 추가: ' + task.retryCount + '/3');
      }
    } finally {
      if (lockAcquired) {
        lock.releaseLock();
      }
    }
  } catch (error) {
    console.log('processQueue 오류: ' + error.toString());
  }

  // 다음 작업 처리 (약간의 지연 추가)
  processNextInQueue();
}

function processNextInQueue() {
  // 바로 다음 작업 처리 (대기시간 없음)
  processQueue();
}
