/**
 * ✅ 처음 1번 실행: refresh_token 저장용
 */
function setKakaoRefreshToken() {
  const refreshToken = '90gP9hdihgx-5EfloKf9zQq-9sUMY8qcAAAAAgoNFN0AAAGWV-y6w4a1Lb_-w10F'; // ← 발급된 refresh_token 넣기
  PropertiesService.getScriptProperties().setProperty('KAKAO_REFRESH_TOKEN', refreshToken);
}

/**
 * 🔁 매번 실행: access_token 자동 갱신
 */
function refreshKakaoAccessToken() {
  const clientId = 'b753d319ccd4300a4c957d7d4c6c9b96'; // ← 네 카카오 앱의 REST API 키
  const refreshToken = PropertiesService.getScriptProperties().getProperty('KAKAO_REFRESH_TOKEN');

  const url = 'https://kauth.kakao.com/oauth/token';
  const payload = {
    grant_type: 'refresh_token',
    client_id: clientId,
    refresh_token: refreshToken,
  };

  const options = {
    method: 'post',
    payload: payload,
  };

  try {
    const response = UrlFetchApp.fetch(url, options);
    const data = JSON.parse(response.getContentText());

    if (data.access_token) {
      PropertiesService.getScriptProperties().setProperty('KAKAO_ACCESS_TOKEN', data.access_token);
      Logger.log('✅ Access Token 자동 갱신 완료');
    }

    if (data.refresh_token) {
      PropertiesService.getScriptProperties().setProperty(
        'KAKAO_REFRESH_TOKEN',
        data.refresh_token
      );
      Logger.log('🔁 Refresh Token도 갱신됨');
    }
  } catch (e) {
    Logger.log('❌ 토큰 갱신 오류: ' + e.message);
  }
}
