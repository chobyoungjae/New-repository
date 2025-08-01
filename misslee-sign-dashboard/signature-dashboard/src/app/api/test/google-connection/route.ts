import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';

export async function GET(request: NextRequest) {
  try {
    console.log('=== Google API 연결 테스트 시작 ===');
    
    // 환경변수 확인
    console.log('GOOGLE_SERVICE_ACCOUNT_EMAIL:', process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ? '✓ 존재' : '✗ 없음');
    console.log('GOOGLE_PRIVATE_KEY:', process.env.GOOGLE_PRIVATE_KEY ? '✓ 존재' : '✗ 없음');
    console.log('MAIN_SPREADSHEET_ID:', process.env.MAIN_SPREADSHEET_ID ? '✓ 존재' : '✗ 없음');

    if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || 
        !process.env.GOOGLE_PRIVATE_KEY || 
        !process.env.MAIN_SPREADSHEET_ID) {
      return NextResponse.json(
        { error: '필수 환경변수가 설정되지 않았습니다.' },
        { status: 500 }
      );
    }

    // Google Auth 설정
    console.log('Google Auth 초기화 중...');
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });
    console.log('Google Sheets API 클라이언트 생성 완료');

    // 스프레드시트 정보 가져오기 (권한 테스트)
    console.log('스프레드시트 접근 테스트 중...');
    const spreadsheet = await sheets.spreadsheets.get({
      spreadsheetId: process.env.MAIN_SPREADSHEET_ID,
    });

    console.log('스프레드시트 접근 성공!');
    console.log('스프레드시트 제목:', spreadsheet.data.properties?.title);
    console.log('시트 목록:', spreadsheet.data.sheets?.map(sheet => sheet.properties?.title));

    return NextResponse.json({
      success: true,
      spreadsheetTitle: spreadsheet.data.properties?.title,
      sheets: spreadsheet.data.sheets?.map(sheet => ({
        id: sheet.properties?.sheetId,
        title: sheet.properties?.title,
      })),
      message: 'Google Sheets API 연결 성공!'
    });

  } catch (error: any) {
    console.error('=== Google API 연결 테스트 실패 ===');
    console.error('오류 타입:', error?.constructor?.name);
    console.error('오류 메시지:', error?.message);
    console.error('오류 코드:', error?.code);
    console.error('전체 오류:', error);

    return NextResponse.json({
      error: 'Google Sheets API 연결 실패',
      details: error?.message,
      code: error?.code,
    }, { status: 500 });
  }
}