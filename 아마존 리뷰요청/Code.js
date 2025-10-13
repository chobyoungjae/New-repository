/**
 * ========================================
 * Amazon SP-API 리뷰 요청 자동화 시스템
 * ========================================
 *
 * 목적: 아마존 셀러센트럴의 "리뷰요청" 버튼 기능을 SP-API로 자동화
 * 실행: 매일 1회 자동 실행 (트리거 설정 필요)
 *
 * 주요 기능:
 * 1. Orders API로 신규 주문 조회 (LastUpdatedAfter 활용)
 * 2. FBA 주문만 필터링
 * 3. 배송일 기준 5~30일 범위 주문 선별
 * 4. Solicitations API로 리뷰 요청 발송
 * 5. 결과를 Google Spreadsheet에 Append
 */

// ========================================
// 설정 상수
// ========================================

const CONFIG = {
  SHEET_NAME: '리뷰요청',

  // 배송일 기준 범위 (일)
  DELIVERY_MIN_DAYS: 5,
  DELIVERY_MAX_DAYS: 30,

  // 재시도 설정
  MAX_RETRIES: 3,
  BACKOFF_DELAYS: [1000, 2000, 4000], // 밀리초

  // 캐시 설정
  CACHE_KEY_ACCESS_TOKEN: 'AMAZON_ACCESS_TOKEN',
  CACHE_TTL_SECONDS: 3000, // 50분 (안전 마진)

  // Script Properties 키 목록
  PROPS: {
    CLIENT_ID: 'LWA_CLIENT_ID',
    CLIENT_SECRET: 'LWA_CLIENT_SECRET',
    REFRESH_TOKEN: 'LWA_REFRESH_TOKEN',
    AWS_ACCESS_KEY: 'AWS_ACCESS_KEY_ID',
    AWS_SECRET_KEY: 'AWS_SECRET_ACCESS_KEY',
    AWS_REGION: 'AWS_REGION',
    MARKETPLACE_ID: 'MARKETPLACE_ID',
    SP_API_ENDPOINT: 'SP_API_ENDPOINT',
    LAST_EXECUTION: 'LAST_EXECUTION_TIME'
  },

  // API 엔드포인트
  LWA_TOKEN_URL: 'https://api.amazon.com/auth/o2/token',

  // 컬럼 인덱스
  COL: {
    NO: 0,
    ORDER_ID: 1,
    SELLER_ORDER_ID: 2,
    ORDER_SUMMARY: 3,
    ASIN: 4,
    SKU: 5,
    FULFILLMENT: 6,
    EARLIEST_DELIVERY: 7,
    LATEST_DELIVERY: 8,
    IS_ELIGIBLE: 9,
    REQUEST_STATUS: 10,
    REQUEST_DATE: 11,
    RESPONSE_MESSAGE: 12,
    REVIEW_URL: 13,
    MEMO: 14
  }
};

// ========================================
// 메인 실행 함수
// ========================================

/**
 * 매일 실행되는 메인 작업 함수
 * 트리거로 자동 실행됨
 */
function dailyReviewRequestJob() {
  try {
    Logger.log('=== 리뷰 요청 작업 시작 ===');

    const props = PropertiesService.getScriptProperties();
    const sheet = getOrCreateSheet(CONFIG.SHEET_NAME);

    // 마지막 실행 시각 가져오기 (없으면 30일 전)
    const lastExecution = getLastExecutionTime(props);
    Logger.log(`마지막 실행 시각: ${lastExecution}`);

    // 1. LWA Access Token 발급
    const accessToken = getLWAToken();

    // 2. Orders API로 신규 주문 조회
    const orders = fetchOrders(accessToken, lastExecution);
    Logger.log(`조회된 주문 수: ${orders.length}`);

    // 3. 각 주문에 대해 리뷰 요청 처리
    let processedCount = 0;
    for (const order of orders) {
      try {
        processOrder(order, accessToken, sheet);
        processedCount++;

        // Rate Limit 고려한 지연
        Utilities.sleep(500);
      } catch (error) {
        Logger.log(`주문 처리 실패 (${order.AmazonOrderId}): ${error.message}`);
      }
    }

    // 4. 현재 시각을 마지막 실행 시각으로 저장
    const currentTime = new Date().toISOString();
    props.setProperty(CONFIG.PROPS.LAST_EXECUTION, currentTime);

    Logger.log(`=== 작업 완료 (처리: ${processedCount}/${orders.length}) ===`);

  } catch (error) {
    Logger.log(`메인 작업 실패: ${error.message}`);
    Logger.log(error.stack);
    throw error;
  }
}

/**
 * 개별 주문 처리
 */
function processOrder(order, accessToken, sheet) {
  const orderId = order.AmazonOrderId;

  // 중복 체크
  if (isDuplicateOrder(orderId, sheet)) {
    Logger.log(`이미 처리된 주문: ${orderId}`);
    return;
  }

  // 주문 아이템 정보 가져오기 (ASIN, SKU)
  const items = getOrderItems(orderId, accessToken);

  // 리뷰 요청 가능 여부 확인
  const eligibility = checkSolicitationEligibility(orderId, accessToken);

  let requestStatus = '대기';
  let responseMessage = '';
  let requestDate = '';

  if (eligibility.isEligible) {
    // 리뷰 요청 발송
    const result = sendReviewRequest(orderId, accessToken);
    requestStatus = result.status;
    responseMessage = result.message;
    requestDate = result.date;
  } else {
    requestStatus = '요청불가';
    responseMessage = eligibility.reason;
  }

  // 시트에 데이터 추가
  appendOrderToSheet(sheet, order, items, {
    isEligible: eligibility.isEligible ? 'Y' : 'N',
    requestStatus,
    requestDate,
    responseMessage
  });
}

// ========================================
// LWA 인증 모듈
// ========================================

/**
 * LWA Access Token 발급 (캐싱 적용)
 * @returns {string} Access Token
 */
function getLWAToken() {
  const cache = CacheService.getScriptCache();
  const cachedToken = cache.get(CONFIG.CACHE_KEY_ACCESS_TOKEN);

  if (cachedToken) {
    Logger.log('캐시된 Access Token 사용');
    return cachedToken;
  }

  Logger.log('새로운 Access Token 발급');
  const props = PropertiesService.getScriptProperties();

  const payload = {
    grant_type: 'refresh_token',
    refresh_token: props.getProperty(CONFIG.PROPS.REFRESH_TOKEN),
    client_id: props.getProperty(CONFIG.PROPS.CLIENT_ID),
    client_secret: props.getProperty(CONFIG.PROPS.CLIENT_SECRET)
  };

  const options = {
    method: 'post',
    contentType: 'application/x-www-form-urlencoded',
    payload: payload,
    muteHttpExceptions: true
  };

  const response = UrlFetchApp.fetch(CONFIG.LWA_TOKEN_URL, options);
  const statusCode = response.getResponseCode();

  if (statusCode !== 200) {
    throw new Error(`LWA Token 발급 실패 (${statusCode}): ${response.getContentText()}`);
  }

  const data = JSON.parse(response.getContentText());
  const accessToken = data.access_token;

  // 캐시에 저장
  cache.put(CONFIG.CACHE_KEY_ACCESS_TOKEN, accessToken, CONFIG.CACHE_TTL_SECONDS);

  return accessToken;
}

// ========================================
// AWS SigV4 서명 모듈
// ========================================

/**
 * AWS SigV4 서명 생성
 * @param {string} method - HTTP 메소드
 * @param {string} path - API 경로
 * @param {string} queryString - 쿼리 스트링
 * @param {string} payload - 요청 본문
 * @param {string} accessToken - LWA Access Token
 * @returns {Object} 서명된 헤더
 */
function generateAwsSigV4(method, path, queryString, payload, accessToken) {
  const props = PropertiesService.getScriptProperties();
  const awsAccessKey = props.getProperty(CONFIG.PROPS.AWS_ACCESS_KEY);
  const awsSecretKey = props.getProperty(CONFIG.PROPS.AWS_SECRET_KEY);
  const region = props.getProperty(CONFIG.PROPS.AWS_REGION);
  const endpoint = props.getProperty(CONFIG.PROPS.SP_API_ENDPOINT);
  const host = endpoint.replace('https://', '');

  const service = 'execute-api';
  const now = new Date();
  const dateStamp = Utilities.formatDate(now, 'UTC', 'yyyyMMdd');
  const amzDate = Utilities.formatDate(now, 'UTC', "yyyyMMdd'T'HHmmss'Z'");

  // 1. Canonical Request 생성
  const canonicalHeaders = `host:${host}\n` +
                          `x-amz-access-token:${accessToken}\n` +
                          `x-amz-date:${amzDate}\n`;
  const signedHeaders = 'host;x-amz-access-token;x-amz-date';
  const payloadHash = sha256Hash(payload);

  const canonicalRequest = [
    method,
    path,
    queryString,
    canonicalHeaders,
    signedHeaders,
    payloadHash
  ].join('\n');

  // 2. String to Sign 생성
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    sha256Hash(canonicalRequest)
  ].join('\n');

  // 3. Signing Key 생성
  const kDate = hmacSha256(dateStamp, `AWS4${awsSecretKey}`);
  const kRegion = hmacSha256(region, kDate);
  const kService = hmacSha256(service, kRegion);
  const kSigning = hmacSha256('aws4_request', kService);

  // 4. Signature 생성
  const signature = hmacSha256(stringToSign, kSigning);

  // 5. Authorization 헤더 생성
  const authorizationHeader = `AWS4-HMAC-SHA256 Credential=${awsAccessKey}/${credentialScope}, ` +
                             `SignedHeaders=${signedHeaders}, ` +
                             `Signature=${signature}`;

  return {
    'Authorization': authorizationHeader,
    'x-amz-access-token': accessToken,
    'x-amz-date': amzDate,
    'host': host
  };
}

/**
 * SHA256 해시 생성 (Hex 문자열 반환)
 */
function sha256Hash(data) {
  const rawHash = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    data,
    Utilities.Charset.UTF_8
  );
  return toHexString(rawHash);
}

/**
 * HMAC-SHA256 생성 (Hex 문자열 반환)
 */
function hmacSha256(data, key) {
  let keyBytes;

  if (typeof key === 'string') {
    keyBytes = Utilities.newBlob(key).getBytes();
  } else {
    keyBytes = key;
  }

  const rawHmac = Utilities.computeHmacSha256Signature(
    data,
    keyBytes
  );

  return toHexString(rawHmac);
}

/**
 * 바이트 배열을 Hex 문자열로 변환
 */
function toHexString(byteArray) {
  return byteArray
    .map(byte => {
      const hex = (byte & 0xFF).toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    })
    .join('');
}

// ========================================
// Orders API 모듈
// ========================================

/**
 * Orders API로 신규 주문 조회
 * @param {string} accessToken - LWA Access Token
 * @param {string} lastUpdatedAfter - ISO 8601 형식 날짜
 * @returns {Array} 필터링된 주문 배열
 */
function fetchOrders(accessToken, lastUpdatedAfter) {
  const props = PropertiesService.getScriptProperties();
  const marketplaceId = props.getProperty(CONFIG.PROPS.MARKETPLACE_ID);
  const endpoint = props.getProperty(CONFIG.PROPS.SP_API_ENDPOINT);

  const path = '/orders/v0/orders';
  const queryParams = {
    MarketplaceIds: marketplaceId,
    LastUpdatedAfter: lastUpdatedAfter,
    FulfillmentChannels: 'AFN' // FBA만
  };

  const queryString = Object.keys(queryParams)
    .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(queryParams[key])}`)
    .join('&');

  const url = `${endpoint}${path}?${queryString}`;
  const headers = generateAwsSigV4('GET', path, queryString, '', accessToken);

  const options = {
    method: 'get',
    headers: headers,
    muteHttpExceptions: true
  };

  const response = makeApiRequestWithRetry(url, options);
  const data = JSON.parse(response.getContentText());

  if (!data.payload || !data.payload.Orders) {
    Logger.log('주문 데이터 없음');
    return [];
  }

  const orders = data.payload.Orders;
  Logger.log(`API에서 조회된 총 주문 수: ${orders.length}`);

  // 배송일 기준 필터링 (5~30일 범위)
  const filteredOrders = orders.filter(order => {
    return isWithinDeliveryRange(order);
  });

  Logger.log(`필터링 후 주문 수: ${filteredOrders.length}`);
  return filteredOrders;
}

/**
 * 배송일 범위 체크 (5~30일)
 */
function isWithinDeliveryRange(order) {
  const latestDeliveryDate = order.LatestDeliveryDate;
  const earliestDeliveryDate = order.EarliestDeliveryDate;

  if (!latestDeliveryDate && !earliestDeliveryDate) {
    return false;
  }

  const now = new Date();
  const deliveryDate = latestDeliveryDate
    ? new Date(latestDeliveryDate)
    : new Date(earliestDeliveryDate);

  const daysSinceDelivery = Math.floor((now - deliveryDate) / (1000 * 60 * 60 * 24));

  return daysSinceDelivery >= CONFIG.DELIVERY_MIN_DAYS &&
         daysSinceDelivery <= CONFIG.DELIVERY_MAX_DAYS;
}

/**
 * 주문 아이템 정보 조회 (ASIN, SKU)
 */
function getOrderItems(orderId, accessToken) {
  const props = PropertiesService.getScriptProperties();
  const endpoint = props.getProperty(CONFIG.PROPS.SP_API_ENDPOINT);

  const path = `/orders/v0/orders/${orderId}/orderItems`;
  const queryString = '';

  const url = `${endpoint}${path}`;
  const headers = generateAwsSigV4('GET', path, queryString, '', accessToken);

  const options = {
    method: 'get',
    headers: headers,
    muteHttpExceptions: true
  };

  try {
    const response = makeApiRequestWithRetry(url, options);
    const data = JSON.parse(response.getContentText());

    if (data.payload && data.payload.OrderItems) {
      return data.payload.OrderItems;
    }
  } catch (error) {
    Logger.log(`주문 아이템 조회 실패 (${orderId}): ${error.message}`);
  }

  return [];
}

// ========================================
// Solicitations API 모듈
// ========================================

/**
 * 리뷰 요청 가능 여부 확인
 */
function checkSolicitationEligibility(orderId, accessToken) {
  const props = PropertiesService.getScriptProperties();
  const endpoint = props.getProperty(CONFIG.PROPS.SP_API_ENDPOINT);

  const path = `/solicitations/v1/orders/${orderId}`;
  const queryString = `marketplaceIds=${props.getProperty(CONFIG.PROPS.MARKETPLACE_ID)}`;

  const url = `${endpoint}${path}?${queryString}`;
  const headers = generateAwsSigV4('GET', path, queryString, '', accessToken);

  const options = {
    method: 'get',
    headers: headers,
    muteHttpExceptions: true
  };

  try {
    const response = makeApiRequestWithRetry(url, options);
    const statusCode = response.getResponseCode();

    if (statusCode !== 200) {
      return {
        isEligible: false,
        reason: `요청 가능 여부 조회 실패 (${statusCode})`
      };
    }

    const data = JSON.parse(response.getContentText());

    // _links.actions에 "productReviewAndSellerFeedback" 액션이 있는지 확인
    if (data._links && data._links.actions) {
      const hasAction = data._links.actions.some(action =>
        action.name === 'productReviewAndSellerFeedback'
      );

      if (hasAction) {
        return { isEligible: true, reason: '' };
      }
    }

    return {
      isEligible: false,
      reason: '요청 가능한 액션 없음 (이미 요청됨 또는 기간 경과)'
    };

  } catch (error) {
    Logger.log(`Eligibility 체크 실패 (${orderId}): ${error.message}`);
    return {
      isEligible: false,
      reason: `체크 실패: ${error.message}`
    };
  }
}

/**
 * 리뷰 요청 발송
 */
function sendReviewRequest(orderId, accessToken) {
  const props = PropertiesService.getScriptProperties();
  const endpoint = props.getProperty(CONFIG.PROPS.SP_API_ENDPOINT);
  const marketplaceId = props.getProperty(CONFIG.PROPS.MARKETPLACE_ID);

  const path = `/solicitations/v1/orders/${orderId}/solicitations/productReviewAndSellerFeedback`;
  const queryString = `marketplaceIds=${marketplaceId}`;

  const url = `${endpoint}${path}?${queryString}`;
  const headers = generateAwsSigV4('POST', path, queryString, '', accessToken);

  const options = {
    method: 'post',
    headers: headers,
    muteHttpExceptions: true
  };

  try {
    const response = makeApiRequestWithRetry(url, options);
    const statusCode = response.getResponseCode();
    const requestDate = new Date().toISOString();

    if (statusCode === 201) {
      return {
        status: '성공',
        message: '리뷰 요청 발송 완료',
        date: requestDate
      };
    } else if (statusCode === 400) {
      return {
        status: '이미요청',
        message: '이미 리뷰 요청이 발송됨',
        date: requestDate
      };
    } else {
      return {
        status: '실패',
        message: `HTTP ${statusCode}: ${response.getContentText()}`,
        date: requestDate
      };
    }

  } catch (error) {
    return {
      status: '실패',
      message: `요청 실패: ${error.message}`,
      date: new Date().toISOString()
    };
  }
}

// ========================================
// 스프레드시트 모듈
// ========================================

/**
 * 시트 가져오기 또는 생성
 */
function getOrCreateSheet(sheetName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    sheet = ss.insertSheet(sheetName);

    // 헤더 작성
    const headers = [
      'No', 'AmazonOrderId', 'SellerOrderId', '주문요약',
      'ASIN', 'SKU', 'FulfillmentChannel',
      'EarliestDeliveryDate', 'LatestDeliveryDate',
      '리뷰요청가능여부', '리뷰요청상태', '리뷰요청일시',
      '응답메시지/에러', 'ASIN리뷰페이지URL', '메모'
    ];

    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }

  return sheet;
}

/**
 * 중복 주문 체크
 */
function isDuplicateOrder(orderId, sheet) {
  const data = sheet.getDataRange().getValues();

  // 첫 번째 행은 헤더이므로 제외
  for (let i = 1; i < data.length; i++) {
    if (data[i][CONFIG.COL.ORDER_ID] === orderId) {
      return true;
    }
  }

  return false;
}

/**
 * 주문 데이터를 시트에 추가
 */
function appendOrderToSheet(sheet, order, items, reviewInfo) {
  const lastRow = sheet.getLastRow();
  const no = lastRow; // 헤더 다음부터 시작

  // 주문 요약 (통화/금액)
  const orderSummary = order.OrderTotal
    ? `${order.OrderTotal.CurrencyCode} ${order.OrderTotal.Amount}`
    : '';

  // 첫 번째 아이템의 ASIN과 SKU 사용
  const firstItem = items.length > 0 ? items[0] : {};
  const asin = firstItem.ASIN || '';
  const sku = firstItem.SellerSKU || '';

  // ASIN 리뷰 페이지 URL
  const reviewUrl = asin
    ? `https://www.amazon.com/product-reviews/${asin}`
    : '';

  const rowData = [
    no,
    order.AmazonOrderId,
    order.SellerOrderId || '',
    orderSummary,
    asin,
    sku,
    order.FulfillmentChannel,
    order.EarliestDeliveryDate || '',
    order.LatestDeliveryDate || '',
    reviewInfo.isEligible,
    reviewInfo.requestStatus,
    reviewInfo.requestDate,
    reviewInfo.responseMessage,
    reviewUrl,
    '' // 메모
  ];

  sheet.appendRow(rowData);
}

// ========================================
// 유틸리티 함수
// ========================================

/**
 * 재시도 로직이 포함된 API 요청
 */
function makeApiRequestWithRetry(url, options, maxRetries = CONFIG.MAX_RETRIES) {
  let lastError;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = UrlFetchApp.fetch(url, options);
      const statusCode = response.getResponseCode();

      // 429 Rate Limit
      if (statusCode === 429) {
        const delay = CONFIG.BACKOFF_DELAYS[attempt] || CONFIG.BACKOFF_DELAYS[CONFIG.BACKOFF_DELAYS.length - 1];
        Logger.log(`Rate Limit 발생, ${delay}ms 대기 후 재시도 (${attempt + 1}/${maxRetries})`);
        Utilities.sleep(delay);
        continue;
      }

      // 5xx 서버 에러
      if (statusCode >= 500) {
        const delay = CONFIG.BACKOFF_DELAYS[attempt] || CONFIG.BACKOFF_DELAYS[CONFIG.BACKOFF_DELAYS.length - 1];
        Logger.log(`서버 에러 ${statusCode}, ${delay}ms 대기 후 재시도 (${attempt + 1}/${maxRetries})`);
        Utilities.sleep(delay);
        continue;
      }

      return response;

    } catch (error) {
      lastError = error;
      Logger.log(`API 요청 실패 (${attempt + 1}/${maxRetries}): ${error.message}`);

      if (attempt < maxRetries - 1) {
        const delay = CONFIG.BACKOFF_DELAYS[attempt];
        Utilities.sleep(delay);
      }
    }
  }

  throw new Error(`API 요청 최종 실패: ${lastError.message}`);
}

/**
 * 마지막 실행 시각 가져오기
 */
function getLastExecutionTime(props) {
  const lastExecution = props.getProperty(CONFIG.PROPS.LAST_EXECUTION);

  if (lastExecution) {
    return lastExecution;
  }

  // 첫 실행: 30일 전
  const date = new Date();
  date.setDate(date.getDate() - 30);
  return date.toISOString();
}

// ========================================
// 트리거 및 메뉴 설정
// ========================================

/**
 * 매일 오전 10시 트리거 설정
 */
function setupDailyTrigger() {
  // 기존 트리거 삭제
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => {
    if (trigger.getHandlerFunction() === 'dailyReviewRequestJob') {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  // 새 트리거 생성
  ScriptApp.newTrigger('dailyReviewRequestJob')
    .timeBased()
    .atHour(10)
    .everyDays(1)
    .create();

  Logger.log('매일 오전 10시 트리거 설정 완료');
}

/**
 * 스프레드시트 열 때 메뉴 생성
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('🔄 리뷰 요청')
    .addItem('🚀 수동 실행', 'dailyReviewRequestJob')
    .addItem('⏰ 트리거 설정', 'setupDailyTrigger')
    .addItem('⚙️ 설정 확인', 'checkConfiguration')
    .addToUi();
}

/**
 * Script Properties 설정 확인
 */
function checkConfiguration() {
  const props = PropertiesService.getScriptProperties();
  const requiredProps = Object.values(CONFIG.PROPS).filter(key => key !== CONFIG.PROPS.LAST_EXECUTION);

  const missingProps = requiredProps.filter(key => !props.getProperty(key));

  if (missingProps.length === 0) {
    SpreadsheetApp.getUi().alert('✅ 모든 설정이 완료되었습니다!');
  } else {
    const message = '❌ 다음 설정이 누락되었습니다:\n\n' + missingProps.join('\n');
    SpreadsheetApp.getUi().alert(message);
  }
}
