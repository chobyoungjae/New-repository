import { google } from 'googleapis';
import { User, Document } from '@/types';

// Google Sheets API 인증 설정
const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  },
  scopes: [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive.file', // 개인 스프레드시트 생성용
    'https://www.googleapis.com/auth/script.projects', // Google Apps Script API용
  ],
});

const sheets = google.sheets({ version: 'v4', auth });
const drive = google.drive({ version: 'v3', auth });

const MAIN_SPREADSHEET_ID = process.env.MAIN_SPREADSHEET_ID || '';

export class GoogleSheetsService {
  // 메인 스프레드시트에서 사용자 조회 (비밀번호 포함)
  static async getUserByLoginId(loginId: string): Promise<(User & { hashedPassword?: string }) | null> {
    try {
      // 먼저 회원정보 시트가 있는지 확인하고 없으면 생성
      await this.ensureMemberInfoSheetExists();
      
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: MAIN_SPREADSHEET_ID,
        range: '회원정보!A:G', // 회원정보 시트의 A(사원번호) ~ G(비밀번호)
      });

      const rows = response.data.values || [];
      
      // 헤더 행 제외하고 검색
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const [employeeNumber, name, personalSheetId, username, email, joinDate, hashedPassword] = row;
        
        // 아이디 또는 이메일로 매칭
        if (username === loginId || email === loginId) {
          return {
            employeeNumber,
            name,
            username,
            email,
            joinDate,
            status: 'active',
            personalSheetId,
            hashedPassword,
          };
        }
      }
      
      return null;
    } catch (error) {
      console.error('Error fetching user:', error);
      throw new Error('사용자 조회 중 오류가 발생했습니다.');
    }
  }

  // 메인 스프레드시트에 새 사용자 추가
  static async createUser(userData: {
    employeeNumber: string;
    name: string;
    username: string;
    email: string;
    personalSheetId: string;
    hashedPassword: string;
  }): Promise<void> {
    try {
      const joinDate = new Date().toISOString().split('T')[0];
      
      // 먼저 '회원정보' 시트가 있는지 확인하고 없으면 생성
      await this.ensureMemberInfoSheetExists();

      const response = await sheets.spreadsheets.values.append({
        spreadsheetId: MAIN_SPREADSHEET_ID,
        range: '회원정보!A:G', // 회원정보 시트의 G열에 비밀번호 추가
        valueInputOption: 'RAW',
        requestBody: {
          values: [[
            userData.employeeNumber,
            userData.name,
            userData.personalSheetId,
            userData.username,
            userData.email,
            joinDate,
            userData.hashedPassword,
          ]],
        },
      });

      console.log('User created:', response.data);
    } catch (error) {
      console.error('Error creating user:', error);
      throw new Error('사용자 생성 중 오류가 발생했습니다.');
    }
  }

  // 기존 개인 스프레드시트 ID를 이름으로 찾기
  static async getPersonalSheetIdByName(userName: string): Promise<string | null> {
    try {
      console.log('개인 스프레드시트 ID 검색 시작:', userName);
      
      // "문서ID" 시트에서 사용자 이름으로 검색
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: MAIN_SPREADSHEET_ID,
        range: '문서ID!A:C', // A, B, C 열 (문서ID, 사용자명, 스프레드시트ID)
      });

      const rows = response.data.values || [];
      console.log('문서ID 시트에서 가져온 행 수:', rows.length);

      // 헤더 행 제외하고 검색
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const [documentId, name, spreadsheetId] = row;
        
        console.log(`행 ${i}: 이름="${name}", 스프레드시트ID="${spreadsheetId}"`);
        
        // 사용자 이름과 매칭
        if (name === userName && spreadsheetId) {
          console.log('매칭된 개인 스프레드시트 ID 찾음:', spreadsheetId);
          return spreadsheetId;
        }
      }
      
      console.log('매칭되는 개인 스프레드시트 ID를 찾지 못함');
      return null;
    } catch (error) {
      console.error('=== 개인 스프레드시트 ID 검색 오류 ===');
      console.error('오류 메시지:', error?.message);
      console.error('전체 오류:', error);
      throw new Error(`개인 스프레드시트 ID 검색 중 오류가 발생했습니다: ${error?.message}`);
    }
  }

  // 개인 스프레드시트 생성 (사용하지 않음 - 기존 시트 사용)
  static async createPersonalSheet(employeeNumber: string): Promise<string> {
    // 이 메서드는 더 이상 사용하지 않음
    throw new Error('개인 스프레드시트는 이미 생성되어 있습니다. getPersonalSheetIdByName()을 사용하세요.');
  }

  // 개인 스프레드시트에서 미서명 문서 조회 (PRD 구조에 맞게)
  static async getUnsignedDocuments(sheetId: string): Promise<Document[]> {
    try {
      console.log('미서명 문서 조회 시작:', sheetId);
      
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: 'A:O', // A(날짜) ~ O(문서링크) - PRD 구조
        valueRenderOption: 'UNFORMATTED_VALUE', // 포맷되지 않은 원본 값
        dateTimeRenderOption: 'FORMATTED_STRING'
      });

      const rows = response.data.values || [];
      const documents: Document[] = [];
      
      console.log('가져온 행 수:', rows.length);

      // 헤더 행 제외하고 처리
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        
        // PRD 구조에 맞게 열 매핑
        const date = row[0] || ''; // A: 날짜
        const title = row[1] || ''; // B: 문서명
        const author = row[2] || ''; // C: 작성자
        const content = row[3] || ''; // D: 내용
        const teamLeaderSig = row[7] || ''; // H: 팀장서명
        const reviewSig = row[8] || ''; // I: 검토서명
        const ceoSig = row[9] || ''; // J: 대표서명
        const isCompleted = row[11] || ''; // L: 완료체크
        const documentLink = row[14] || ''; // O: 문서링크
        
        console.log(`행 ${i}: 제목="${title}", 완료상태="${isCompleted}"`);
        console.log(`서명 데이터: 팀장="${teamLeaderSig}", 검토="${reviewSig}", 대표="${ceoSig}"`);
        console.log(`서명 타입: 팀장=${typeof teamLeaderSig}, 검토=${typeof reviewSig}, 대표=${typeof ceoSig}`);
        console.log(`서명 길이: 팀장=${teamLeaderSig?.length}, 검토=${reviewSig?.length}, 대표=${ceoSig?.length}`);
        
        // 완료되지 않은 문서만 반환 (L열이 FALSE 또는 비어있음)
        if (!isCompleted || isCompleted.toLowerCase() !== 'true') {
          // 셀 메타데이터에서 이미지 URL 추출 시도
          const teamLeaderImageUrl = await this.getCellImageInfo(sheetId, i, 7); // H열 (7번째 인덱스)
          const reviewImageUrl = await this.getCellImageInfo(sheetId, i, 8); // I열 (8번째 인덱스)  
          const ceoImageUrl = await this.getCellImageInfo(sheetId, i, 9); // J열 (9번째 인덱스)
          
          documents.push({
            id: `${sheetId}_${i}`,
            date: date,
            title: title,
            author: author,
            content: content,
            teamLeaderSignature: teamLeaderSig,
            reviewSignature: reviewSig,
            ceoSignature: ceoSig,
            teamLeaderSignatureImage: teamLeaderImageUrl || GoogleSheetsService.extractImageUrl(teamLeaderSig),
            reviewSignatureImage: reviewImageUrl || GoogleSheetsService.extractImageUrl(reviewSig),
            ceoSignatureImage: ceoImageUrl || GoogleSheetsService.extractImageUrl(ceoSig),
            isCompleted: false,
            documentLink: documentLink, // O열의 문서 링크
          });
        }
      }

      console.log('미서명 문서 개수:', documents.length);
      return documents;
    } catch (error) {
      console.error('Error fetching documents:', error);
      throw new Error('문서 조회 중 오류가 발생했습니다.');
    }
  }

  // 셀 메타데이터에서 이미지 정보 확인
  private static async getCellImageInfo(sheetId: string, rowIndex: number, colIndex: number): Promise<string | undefined> {
    try {
      console.log(`셀 이미지 정보 조회: 시트=${sheetId}, 행=${rowIndex}, 열=${colIndex}`);
      
      const spreadsheet = await sheets.spreadsheets.get({
        spreadsheetId: sheetId,
        ranges: [`R${rowIndex + 1}C${colIndex + 1}`],
        includeGridData: true,
      });

      const sheet = spreadsheet.data.sheets?.[0];
      const gridData = sheet?.data?.[0];
      const rowData = gridData?.rowData?.[0];
      const cellData = rowData?.values?.[0];

      console.log('셀 데이터:', JSON.stringify(cellData, null, 2));

      // 이미지가 있는 경우 effectiveValue나 다른 속성에서 URL 찾기
      if (cellData?.effectiveValue) {
        console.log('effectiveValue:', cellData.effectiveValue);
      }
      
      if (cellData?.userEnteredValue) {
        console.log('userEnteredValue:', cellData.userEnteredValue);
      }

      // 이미지 URL 추출 시도
      const effectiveValue = cellData?.effectiveValue?.stringValue || '';
      const userValue = cellData?.userEnteredValue?.stringValue || '';
      
      // 기본 URL 추출 시도
      let imageUrl = this.extractImageUrl(effectiveValue) || this.extractImageUrl(userValue);
      
      // 이미지 URL이 없고 셀에 이미지 객체가 있는 경우 Drive API 시도
      if (!imageUrl && cellData) {
        imageUrl = await this.tryExtractImageFromDrive(cellData);
      }
      
      return imageUrl;
    } catch (error) {
      console.error('셀 이미지 정보 조회 오류:', error);
      return undefined;
    }
  }

  // IMPORTRANGE 함수 결과에서 이미지 URL 추출
  private static extractImageUrl(cellValue: string): string | undefined {
    if (!cellValue) return undefined;
    
    console.log('이미지 URL 추출 시도:', cellValue);
    
    // 다양한 Google 이미지 URL 패턴들
    const patterns = [
      // Google Drive 직접 링크
      /https:\/\/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/i,
      // Google Drive uc 링크  
      /https:\/\/drive\.google\.com\/uc\?id=([a-zA-Z0-9_-]+)/i,
      // Google Docs 이미지
      /https:\/\/docs\.google\.com\/[^\s"']+/i,
      // 일반적인 Google 도메인 이미지
      /https:\/\/[^.\s]*\.google\.com\/[^\s"']+\.(jpg|jpeg|png|gif|webp)/i,
      // 모든 Google 링크
      /https:\/\/[^.\s]*\.google\.com\/[^\s"']+/i
    ];
    
    for (const pattern of patterns) {
      const match = cellValue.match(pattern);
      if (match) {
        let imageUrl = match[0];
        
        // Google Drive 파일 ID가 있는 경우 공개 뷰어 URL로 변환
        const fileIdMatch = imageUrl.match(/\/file\/d\/([a-zA-Z0-9_-]+)|id=([a-zA-Z0-9_-]+)/);
        if (fileIdMatch) {
          const fileId = fileIdMatch[1] || fileIdMatch[2];
          imageUrl = `https://drive.google.com/uc?id=${fileId}&export=view`;
        }
        
        console.log('추출된 이미지 URL:', imageUrl);
        return imageUrl;
      }
    }
    
    // JSON 형태의 값에서 URL 추출 시도
    try {
      const parsed = JSON.parse(cellValue);
      if (parsed.url || parsed.src || parsed.href) {
        const url = parsed.url || parsed.src || parsed.href;
        console.log('JSON에서 추출된 URL:', url);
        return url;
      }
    } catch {
      // JSON 파싱 실패는 무시
    }
    
    console.log('이미지 URL을 찾을 수 없음');
    return undefined;
  }

  // Drive API를 통한 이미지 추출 시도
  private static async tryExtractImageFromDrive(cellData: any): Promise<string | undefined> {
    try {
      console.log('Drive API로 이미지 검색 시도');
      
      // 셀 데이터에서 이미지 관련 정보 찾기
      const formats = cellData?.effectiveFormat || {};
      const textFormat = formats?.textFormat || {};
      
      // 이미지 ID나 링크 정보가 있는지 확인
      if (textFormat?.link && textFormat.link.uri) {
        console.log('텍스트 포맷에서 링크 발견:', textFormat.link.uri);
        return this.extractImageUrl(textFormat.link.uri);
      }
      
      // 셀에 하이퍼링크가 있는 경우
      if (cellData?.hyperlink) {
        console.log('하이퍼링크 발견:', cellData.hyperlink);
        return this.extractImageUrl(cellData.hyperlink);
      }
      
      console.log('Drive API에서 이미지를 찾을 수 없음');
      return undefined;
    } catch (error) {
      console.error('Drive API 이미지 추출 오류:', error);
      return undefined;
    }
  }

  // 서명 완료 처리 (PRD 구조에 맞게 - L열)
  static async completeSignature(sheetId: string, rowIndex: number): Promise<void> {
    try {
      console.log(`서명 완료 처리: 시트=${sheetId}, 행=${rowIndex + 1}`);
      
      // 먼저 해당 셀을 체크박스로 설정
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: sheetId,
        requestBody: {
          requests: [
            {
              repeatCell: {
                range: {
                  sheetId: 0, // 첫 번째 시트
                  startRowIndex: rowIndex, // 0-based
                  endRowIndex: rowIndex + 1,
                  startColumnIndex: 11, // L열 (0-based)
                  endColumnIndex: 12,
                },
                cell: {
                  dataValidation: {
                    condition: {
                      type: 'BOOLEAN',
                    },
                  },
                },
                fields: 'dataValidation',
              },
            },
          ],
        },
      });

      // 그 다음 TRUE 값으로 체크 표시
      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: `L${rowIndex + 1}`, // L열 (완료체크) - PRD 구조
        valueInputOption: 'RAW',
        requestBody: {
          values: [[true]], // boolean true로 전송
        },
      });

      // 트리거 함수 수동 호출 (API 업데이트는 트리거를 발동시키지 않으므로)
      await this.triggerSheetFunction(sheetId, rowIndex + 1);

      console.log(`서명 완료 처리 성공: 행 ${rowIndex + 1} (체크박스로 설정, 트리거 호출)`);
    } catch (error) {
      console.error('Error completing signature:', error);
      throw new Error('서명 완료 처리 중 오류가 발생했습니다.');
    }
  }

  // 사용자별 스크립트 프로젝트 ID 조회
  static async getScriptIdByName(userName: string): Promise<string | null> {
    try {
      console.log('스크립트 ID 검색 시작:', userName);
      
      // "문서ID" 시트에서 사용자 이름으로 스크립트 ID 검색
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: MAIN_SPREADSHEET_ID,
        range: '문서ID!A:D', // A, B, C, D 열 (문서ID, 사용자명, 스프레드시트ID, 스크립트프로젝트ID)
      });

      const rows = response.data.values || [];
      console.log('문서ID 시트에서 가져온 행 수:', rows.length);

      // 헤더 행 제외하고 검색
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const [documentId, name, spreadsheetId, scriptId] = row;
        
        console.log(`행 ${i}: 이름="${name}", 스크립트ID="${scriptId}"`);
        
        // 사용자 이름과 매칭
        if (name === userName && scriptId) {
          console.log('매칭된 스크립트 프로젝트 ID 찾음:', scriptId);
          return scriptId;
        }
      }
      
      console.log('매칭되는 스크립트 프로젝트 ID를 찾지 못함');
      return null;
    } catch (error) {
      console.error('스크립트 ID 검색 오류:', error);
      return null;
    }
  }

  // Webhook을 통한 Google Apps Script 트리거 호출
  static async triggerSheetFunction(sheetId: string, rowNumber: number): Promise<void> {
    try {
      console.log(`웹훅 트리거 호출: 시트=${sheetId}, 행=${rowNumber}`);
      
      // 먼저 현재 사용자 정보 가져오기 (sheetId로 사용자 찾기)
      const userName = await this.getUserNameBySheetId(sheetId);
      if (!userName) {
        console.log('사용자 이름을 찾을 수 없습니다');
        return;
      }

      // 사용자별 웹훅 URL 가져오기 (문서ID 시트의 E열에 웹훅 URL 저장)
      const webhookUrl = await this.getWebhookUrlByName(userName);
      if (!webhookUrl) {
        console.log('웹훅 URL을 찾을 수 없습니다:', userName);
        return;
      }

      console.log('사용할 웹훅 URL:', webhookUrl);

      // HTTP POST 요청으로 웹훅 호출
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sheetId: sheetId,
          rowNumber: rowNumber,
          userName: userName,
          column: 12, // L열
          value: true
        }),
      });

      if (response.ok) {
        const result = await response.text();
        console.log('웹훅 호출 성공:', result);
      } else {
        console.error('웹훅 호출 실패:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('웹훅 호출 오류:', error);
      // 웹훅 호출 실패는 치명적이지 않으므로 에러를 던지지 않음
    }
  }

  // 사용자별 웹훅 URL 조회 (문서ID 시트의 E열)
  static async getWebhookUrlByName(userName: string): Promise<string | null> {
    try {
      console.log('웹훅 URL 검색 시작:', userName);
      
      // "문서ID" 시트에서 사용자 이름으로 웹훅 URL 검색
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: MAIN_SPREADSHEET_ID,
        range: '문서ID!A:E', // A, B, C, D, E 열 (문서ID, 사용자명, 스프레드시트ID, 스크립트프로젝트ID, 웹훅URL)
      });

      const rows = response.data.values || [];
      console.log('문서ID 시트에서 가져온 행 수:', rows.length);

      // 헤더 행 제외하고 검색
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const [documentId, name, spreadsheetId, scriptId, webhookUrl] = row;
        
        console.log(`행 ${i}: 이름="${name}", 웹훅URL="${webhookUrl}"`);
        
        // 사용자 이름과 매칭
        if (name === userName && webhookUrl) {
          console.log('매칭된 웹훅 URL 찾음:', webhookUrl);
          return webhookUrl;
        }
      }
      
      console.log('매칭되는 웹훅 URL을 찾지 못함');
      return null;
    } catch (error) {
      console.error('웹훅 URL 검색 오류:', error);
      return null;
    }
  }

  // 스프레드시트 ID로 사용자 이름 찾기
  static async getUserNameBySheetId(sheetId: string): Promise<string | null> {
    try {
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: MAIN_SPREADSHEET_ID,
        range: '문서ID!A:C',
      });

      const rows = response.data.values || [];
      
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const [documentId, name, spreadsheetId] = row;
        
        if (spreadsheetId === sheetId) {
          return name;
        }
      }
      
      return null;
    } catch (error) {
      console.error('사용자 이름 검색 오류:', error);
      return null;
    }
  }

  // 스프레드시트의 특정 범위 데이터 가져오기 (미리보기용)
  static async getSheetData(sheetId: string, range: string): Promise<any[][]> {
    try {
      console.log('스프레드시트 데이터 조회:', { sheetId, range });
      
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: range,
        valueRenderOption: 'FORMATTED_VALUE', // 포맷된 값으로 가져오기
        dateTimeRenderOption: 'FORMATTED_STRING'
      });

      const rows = response.data.values || [];
      console.log('조회된 행 수:', rows.length);
      
      return rows;
    } catch (error) {
      console.error('스프레드시트 데이터 조회 오류:', error);
      throw new Error('스프레드시트 데이터를 가져올 수 없습니다.');
    }
  }

  // GID로 특정 시트의 데이터 가져오기
  static async getSheetDataByGid(sheetId: string, gid: string, range: string): Promise<any[][]> {
    try {
      console.log('GID로 스프레드시트 데이터 조회:', { sheetId, gid, range });
      
      // 먼저 스프레드시트 메타데이터를 가져와서 시트 이름 찾기
      const spreadsheet = await sheets.spreadsheets.get({
        spreadsheetId: sheetId,
      });

      const targetSheet = spreadsheet.data.sheets?.find(
        sheet => sheet.properties?.sheetId?.toString() === gid
      );

      if (!targetSheet) {
        throw new Error(`GID ${gid}에 해당하는 시트를 찾을 수 없습니다.`);
      }

      const sheetName = targetSheet.properties?.title;
      console.log('찾은 시트명:', sheetName);

      // 시트명과 범위를 조합하여 데이터 가져오기
      const fullRange = `${sheetName}!${range}`;
      console.log('전체 범위:', fullRange);

      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: fullRange,
        valueRenderOption: 'FORMATTED_VALUE',
        dateTimeRenderOption: 'FORMATTED_STRING'
      });

      const rows = response.data.values || [];
      console.log('GID로 조회된 행 수:', rows.length);
      
      return rows;
    } catch (error) {
      console.error('GID로 스프레드시트 데이터 조회 오류:', error);
      throw new Error('GID로 스프레드시트 데이터를 가져올 수 없습니다.');
    }
  }

  // 아이디 중복 확인
  static async checkUsernameExists(username: string): Promise<boolean> {
    try {
      const user = await this.getUserByLoginId(username);
      return user !== null;
    } catch (error) {
      console.error('Error checking username:', error);
      return false;
    }
  }

  // 이메일 중복 확인
  static async checkEmailExists(email: string): Promise<boolean> {
    try {
      const user = await this.getUserByLoginId(email);
      return user !== null;
    } catch (error) {
      console.error('Error checking email:', error);
      return false;
    }
  }

  // 최신 사원번호 조회
  static async getLastEmployeeNumber(): Promise<string | null> {
    try {
      // 먼저 회원정보 시트가 있는지 확인하고 없으면 생성
      await this.ensureMemberInfoSheetExists();
      
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: MAIN_SPREADSHEET_ID,
        range: '회원정보!A:A',
      });

      const rows = response.data.values || [];
      let lastNumber = '';

      // 헤더 행 제외하고 마지막 사원번호 찾기
      for (let i = 1; i < rows.length; i++) {
        const employeeNumber = rows[i][0];
        if (employeeNumber && employeeNumber.startsWith('EMP')) {
          lastNumber = employeeNumber;
        }
      }

      return lastNumber || null;
    } catch (error) {
      console.error('Error fetching last employee number:', error);
      return null;
    }
  }

  // '회원정보' 시트가 존재하는지 확인하고 없으면 생성
  static async ensureMemberInfoSheetExists(): Promise<void> {
    try {
      // 먼저 시트 목록을 가져와서 '회원정보' 시트가 있는지 확인
      const spreadsheet = await sheets.spreadsheets.get({
        spreadsheetId: MAIN_SPREADSHEET_ID,
      });

      const existingSheets = spreadsheet.data.sheets || [];
      const memberInfoSheetExists = existingSheets.some(
        sheet => sheet.properties?.title === '회원정보'
      );

      if (!memberInfoSheetExists) {
        // '회원정보' 시트 생성
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId: MAIN_SPREADSHEET_ID,
          requestBody: {
            requests: [
              {
                addSheet: {
                  properties: {
                    title: '회원정보',
                  },
                },
              },
            ],
          },
        });

        // 헤더 행 추가
        await sheets.spreadsheets.values.update({
          spreadsheetId: MAIN_SPREADSHEET_ID,
          range: '회원정보!A1:G1',
          valueInputOption: 'RAW',
          requestBody: {
            values: [[
              '사원번호',
              '사용자명',
              '개인스프레드시트ID',
              '아이디',
              '이메일',
              '가입일',
              '비밀번호'
            ]],
          },
        });

        console.log('회원정보 시트가 생성되었습니다.');
      }
    } catch (error) {
      console.error('Error ensuring member info sheet exists:', error);
      throw new Error('회원정보 시트 생성 중 오류가 발생했습니다.');
    }
  }
}