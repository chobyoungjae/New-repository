const ROLE = 'leader'; // 이 보드는 leader 역할용

/**
 * 설치형 onEdit 트리거 함수
 * 12열(체크박스) 체크 시 팝업 띄우기
 */
function onEditInstallable(e) {
  const { range, value } = e;
  const sheet = range.getSheet();

  // — ① 반드시 팀장보드 시트 이름이면 동작
  if (sheet.getName() !== '시트1') return;
  // — ② 12열 + TRUE 체크만 감지
  if (range.getColumn() !== 12 || value !== 'TRUE') return;

  const row = range.getRow();
  const ui = SpreadsheetApp.getUi();

  // — ③ 문서ID 시트에서 이 행의 URL 꺼내기
  const docName = sheet.getRange(row, 2).getDisplayValue().trim();
  if (!docName) {
    ui.alert('B열에 문서명이 없습니다.');
    return;
  }
  const lookupSh = SpreadsheetApp.getActive().getSheetByName('문서ID');
  const rows = lookupSh.getRange(2, 1, lookupSh.getLastRow() - 1, 5).getValues();
  let hubUrl = '';
  for (let r of rows) {
    if (r[0] === docName) {
      hubUrl = String(r[4]).trim();
      break;
    }
  }
  if (!hubUrl) {
    ui.alert(`문서ID 시트에 "${docName}" URL이 없습니다.`);
    return;
  }

  // — ④ 원본 A시트 행 번호(K열=11) 가져오기
  const srcRow = sheet.getRange(row, 11).getValue();
  if (!srcRow) {
    ui.alert('K열에 원본 행 번호가 없습니다.');
    return;
  }

  // — ⑤ WebApp(doGet) 새 창으로 열기
  const url = `${hubUrl}?role=${ROLE}&row=${srcRow}`;
  const html = HtmlService.createHtmlOutput(
    `<script>window.open("${url}", "_blank"); google.script.host.close();</script>`
  )
    .setWidth(10)
    .setHeight(10);
  ui.showModalDialog(html, '서명 페이지로 이동 중...');
}

/**
 * 매니페스트 스코프 승인을 위한 더미 함수
 */
function __grantScopes() {
  return true;
}
// 수정했지롱
