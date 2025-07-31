import { google } from 'googleapis';
import { User, Document } from '@/types';

// Google Sheets API 인증 설정
const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  },
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const sheets = google.sheets({ version: 'v4', auth });

const MAIN_SPREADSHEET_ID = process.env.MAIN_SPREADSHEET_ID || '';

export class GoogleSheetsService {
  // 메인 스프레드시트에서 사용자 조회 (비밀번호 포함)
  static async getUserByLoginId(loginId: string): Promise<(User & { hashedPassword?: string }) | null> {
    try {
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: MAIN_SPREADSHEET_ID,
        range: 'A:G', // A(사원번호) ~ G(비밀번호)
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
      
      const response = await sheets.spreadsheets.values.append({
        spreadsheetId: MAIN_SPREADSHEET_ID,
        range: 'A:G', // G열에 비밀번호 추가
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

  // 개인 스프레드시트 생성
  static async createPersonalSheet(employeeNumber: string): Promise<string> {
    try {
      const response = await sheets.spreadsheets.create({
        requestBody: {
          properties: {
            title: `${employeeNumber}_개인문서`,
          },
          sheets: [{
            properties: {
              title: '문서목록',
            },
            data: [{
              rowData: [{
                values: [
                  { userEnteredValue: { stringValue: '날짜' } },
                  { userEnteredValue: { stringValue: '문서명' } },
                  { userEnteredValue: { stringValue: '작성자' } },
                  { userEnteredValue: { stringValue: '내용' } },
                  { userEnteredValue: { stringValue: '팀장서명' } },
                  { userEnteredValue: { stringValue: '검토서명' } },
                  { userEnteredValue: { stringValue: '대표서명' } },
                  { userEnteredValue: { stringValue: '완료체크' } },
                  { userEnteredValue: { stringValue: '문서링크' } },
                ],
              }],
            }],
          }],
        },
      });

      const spreadsheetId = response.data.spreadsheetId || '';
      console.log('Personal sheet created:', spreadsheetId);
      return spreadsheetId;
    } catch (error) {
      console.error('Error creating personal sheet:', error);
      throw new Error('개인 스프레드시트 생성 중 오류가 발생했습니다.');
    }
  }

  // 개인 스프레드시트에서 미서명 문서 조회
  static async getUnsignedDocuments(sheetId: string): Promise<Document[]> {
    try {
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: 'A:I', // A(날짜) ~ I(문서링크)
      });

      const rows = response.data.values || [];
      const documents: Document[] = [];

      // 헤더 행 제외하고 처리
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const [date, title, author, content, teamLeaderSig, reviewSig, ceoSig, isCompleted, documentLink] = row;
        
        // 완료되지 않은 문서만 반환 (L열이 FALSE 또는 비어있음)
        if (!isCompleted || isCompleted.toLowerCase() !== 'true') {
          documents.push({
            id: `${sheetId}_${i}`,
            date: date || '',
            title: title || '',
            author: author || '',
            content: content || '',
            teamLeaderSignature: teamLeaderSig,
            reviewSignature: reviewSig,
            ceoSignature: ceoSig,
            isCompleted: false,
            documentLink: documentLink,
          });
        }
      }

      return documents;
    } catch (error) {
      console.error('Error fetching documents:', error);
      throw new Error('문서 조회 중 오류가 발생했습니다.');
    }
  }

  // 서명 완료 처리
  static async completeSignature(sheetId: string, rowIndex: number): Promise<void> {
    try {
      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: `H${rowIndex + 1}`, // L열 (완료체크)
        valueInputOption: 'RAW',
        requestBody: {
          values: [['TRUE']],
        },
      });

      console.log(`Signature completed for row ${rowIndex + 1}`);
    } catch (error) {
      console.error('Error completing signature:', error);
      throw new Error('서명 완료 처리 중 오류가 발생했습니다.');
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
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: MAIN_SPREADSHEET_ID,
        range: 'A:A',
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
}