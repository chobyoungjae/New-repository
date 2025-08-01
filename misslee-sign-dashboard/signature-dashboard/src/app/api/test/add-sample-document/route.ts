import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { GoogleSheetsService } from '@/lib/googleSheets';

const JWT_SECRET = process.env.NEXTAUTH_SECRET || 'your-secret-key';

// 개발 환경에서만 사용할 테스트용 API
export async function POST(request: NextRequest) {
  // 프로덕션 환경에서는 비활성화
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: '이 API는 개발 환경에서만 사용할 수 있습니다.' },
      { status: 403 }
    );
  }

  try {
    // JWT 토큰 검증으로 현재 로그인한 사용자 확인
    const token = request.cookies.get('token')?.value;
    
    if (!token) {
      return NextResponse.json(
        { error: '로그인이 필요합니다.' },
        { status: 401 }
      );
    }

    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET) as any;
    } catch (error) {
      return NextResponse.json(
        { error: '유효하지 않은 토큰입니다.' },
        { status: 401 }
      );
    }

    // 사용자의 개인 스프레드시트 ID 가져오기
    const user = await GoogleSheetsService.getUserByLoginId(decoded.username);
    
    if (!user || !user.personalSheetId) {
      return NextResponse.json(
        { error: '사용자 정보 또는 개인 스프레드시트를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    console.log('샘플 데이터 추가 대상 시트:', user.personalSheetId);

    // Google Sheets API를 사용해서 샘플 문서 추가
    const { google } = require('googleapis');
    
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    // PRD에 맞는 샘플 문서 데이터 (A~O열 구조)
    const today = new Date();
    const sampleDocuments = [
      [
        today.toISOString().split('T')[0].substring(2).replace(/-/g, '.'), // A: 날짜 (yy.mm.dd)
        '월간 보고서', // B: 문서명
        '김철수', // C: 작성자
        '1월 매출 보고서 승인 요청입니다. 전월 대비 15% 증가한 실적을 보이고 있습니다.', // D: 내용
        '', '', '', '', // E, F, G (빈 열)
        'https://via.placeholder.com/100x50/4285f4/white?text=팀장', // H: 팀장서명
        'https://via.placeholder.com/100x50/34a853/white?text=검토', // I: 검토서명
        '', // J: 대표서명 (비어있음)
        '', // K (빈 열)
        'FALSE', // L: 완료체크
        '', '', // M, N (빈 열)
        'https://docs.google.com/spreadsheets/d/1A4oAr56J9ei2szU5vOm47UE5JlxjqfmmO4pXVVZmE98?gid=0' // O: 문서링크
      ],
      [
        new Date(today.getTime() - 86400000).toISOString().split('T')[0].substring(2).replace(/-/g, '.'), // 어제
        '휴가 신청서',
        '이영희',
        '2월 둘째 주 연차휴가 신청합니다. (2/10~2/12, 3일간)',
        '', '', '', '',
        '', // H: 팀장서명 (비어있음)
        '',
        '',
        '',
        'FALSE',
        '', '',
        'https://docs.google.com/spreadsheets/d/1A4oAr56J9ei2szU5vOm47UE5JlxjqfmmO4pXVVZmE98?gid=1'
      ],
      [
        new Date(today.getTime() - 172800000).toISOString().split('T')[0].substring(2).replace(/-/g, '.'), // 2일 전
        '프로젝트 제안서',
        '박민수',
        '신규 프로젝트 "Smart Dashboard" 개발 제안서입니다. 예상 개발기간 3개월, 예산 5천만원.',
        '', '', '', '',
        'https://via.placeholder.com/100x50/4285f4/white?text=팀장',
        '', // I: 검토서명 (비어있음)
        '',
        '',
        'FALSE',
        '', '',
        'https://docs.google.com/spreadsheets/d/1A4oAr56J9ei2szU5vOm47UE5JlxjqfmmO4pXVVZmE98?gid=2'
      ]
    ];

    // 샘플 데이터를 스프레드시트에 추가
    await sheets.spreadsheets.values.append({
      spreadsheetId: user.personalSheetId,
      range: 'A:O', // A부터 O열까지
      valueInputOption: 'RAW',
      requestBody: {
        values: sampleDocuments,
      },
    });

    return NextResponse.json({ 
      success: true, 
      message: '샘플 문서가 추가되었습니다.',
      addedCount: sampleDocuments.length,
      personalSheetId: user.personalSheetId
    });
  } catch (error) {
    console.error('Sample document API error:', error);
    return NextResponse.json(
      { error: '샘플 문서 추가 중 오류가 발생했습니다.', details: error?.message },
      { status: 500 }
    );
  }
}