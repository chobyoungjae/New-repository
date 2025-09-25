const ROLE = 'leader';  // 보드마다 'leader'/'reviewer'/'ceo'/'manager'로 바꿔 주세요

/**
 * 설치형 onEdit 트리거용 함수
 */
function onEditInstallable(e) {
  // ① L열(12번) 체크박스만 감지
  if (e.range.columnStart !== 12 || e.value !== 'TRUE') return;

  const boardSh  = e.range.getSheet();
  const boardRow = e.range.getRow();
  const ui       = SpreadsheetApp.getUi();

  // ② 보드 시트에서 문서명(B열) 읽기
  const docName = boardSh.getRange(boardRow, 2).getDisplayValue().trim();
  if (!docName) {
    ui.alert('B열에 문서명이 없습니다.');
    return;
  }

  // ③ “문서ID” 시트에서 해당 문서명 찾고 E열(URL) 꺼내기
  const lookupSh = SpreadsheetApp.getActive().getSheetByName('문서ID');
  const data     = lookupSh.getRange(2, 1, lookupSh.getLastRow() - 1, 5).getValues();
  let hubUrl     = '';
  for (let i = 0; i < data.length; i++) {
    if (data[i][0] === docName) {
      hubUrl = data[i][4].toString().trim();
      break;
    }
  }
  if (!hubUrl) {
    ui.alert(`문서ID 시트에서 "${docName}"을(를) 찾을 수 없거나, E열에 URL이 없습니다.`);
    return;
  }

  // ④ 보드 시트에서 원본 행 번호(K열=11번) 읽기
  const srcRow = boardSh.getRange(boardRow, 11).getValue();
  if (!srcRow) {
    ui.alert('K열에 원본 행 번호가 없습니다.');
    return;
  }

  // ⑤ 중앙 스크립트 doGet 호출 (role + row)
  try {
    UrlFetchApp.fetch(`${hubUrl}?role=${ROLE}&row=${srcRow}`);
  } catch (err) {
    ui.alert('doGet 호출 중 오류: ' + err.message);
    return;
  }

  // ⑥ 완료 표시: M열(13번)에 ✔
  boardSh.getRange(boardRow, 13).setValue('✅');
}


/**
 * 매니페스트 스코프 승인을 위한 더미 함수
 */
function __grantScopes() {
  return true;
}
