function loginToEcountWithOfficialKey() {
  const payload = {
    "COM_CODE": "606274", // 형님 회사 코드
    "USER_ID": "OOSDREAM", // 형님 로그인 ID
    "API_CERT_KEY": "1b633bde6273d4ce2ae69e3b357e41eda0", // 정식 인증키
    "LAN_TYPE": "ko-KR", // 언어
    "ZONE": "CB" // ZONE 값
  };

  const options = {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload),
    headers: {
      "User-Agent": "GoogleAppsScript"
    },
    muteHttpExceptions: true // 전체 응답을 받아보기 위함
  };

  const apiUrl = "https://oapiCB.ecount.com/OAPI/V2/OAPILogin";

  try {
    const response = UrlFetchApp.fetch(apiUrl, options);
    const text = response.getContentText();
    Logger.log("응답 원문: " + text);
    const json = JSON.parse(text);

    if (json.Status === "200" && json.Data && json.Data.Datas && json.Data.Datas.SESSION_ID) {
      const sessionId = json.Data.Datas.SESSION_ID;
      Logger.log("✅ 로그인 성공! 세션 ID: " + sessionId);
      return sessionId;
    } else {
      Logger.log("❌ 로그인 실패: " + JSON.stringify(json));
      return null;
    }
  } catch (e) {
    Logger.log("🔥 에러 발생: " + e.message);
    return null;
  }
}
