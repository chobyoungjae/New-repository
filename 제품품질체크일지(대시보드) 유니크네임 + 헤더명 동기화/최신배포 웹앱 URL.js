function updateHubUrlByVersion() {
  const ss = SpreadsheetApp.getActive();
  const sheet = ss.getSheetByName('B시트');
  
  try {
    const scriptId = ScriptApp.getScriptId();
    const token = ScriptApp.getOAuthToken();
    const url = `https://script.googleapis.com/v1/projects/${scriptId}/deployments`;

    // REST 호출 (Apps Script API 권한 필요)
    const res = UrlFetchApp.fetch(url, {
      headers: { Authorization: 'Bearer ' + token },
    });
    const deps = (JSON.parse(res.getContentText()).deployments || [])
      // 버전 번호가 있는 항목 필터
      .filter(d => d.deploymentConfig && d.deploymentConfig.versionNumber)
      // versionNumber 내림차순 정렬
      .sort((a, b) => b.deploymentConfig.versionNumber - a.deploymentConfig.versionNumber);

    if (!deps.length) {
      sheet.getRange('T5').setValue('❌ 배포 없음');
      return;
    }

    // 최신 버전의 WEB_APP entryPoint
    const latest = deps[0];
    const ep = (latest.entryPoints || []).find(
      e => e.entryPointType === 'WEB_APP' && e.webApp && e.webApp.url
    );
    const execUrl = ep ? ep.webApp.url : '❌ exec URL 없음';

    sheet.getRange('T5').setValue(execUrl);
  } catch (error) {
    // Apps Script API 권한이 없을 경우 대체 방법
    console.error('Apps Script API 권한 오류:', error);
    sheet.getRange('T5').setValue('⚠️ 수동으로 웹앱 URL을 입력하세요');
    
    // 현재 스크립트의 기본 정보 표시
    const scriptId = ScriptApp.getScriptId();
    sheet.getRange('T6').setValue(`스크립트 ID: ${scriptId}`);
    sheet.getRange('T7').setValue('배포 → 새 배포 → 웹앱 URL을 T5셀에 붙여넣으세요');
  }
}
