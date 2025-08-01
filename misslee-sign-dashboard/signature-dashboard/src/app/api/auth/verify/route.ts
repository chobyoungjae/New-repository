import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { GoogleSheetsService } from '@/lib/googleSheets';

const JWT_SECRET = process.env.NEXTAUTH_SECRET || 'fallback-secret';

export async function GET(request: NextRequest) {
  try {
    // JWT 토큰 검증
    const token = request.cookies.get('token')?.value;
    
    if (!token) {
      return NextResponse.json(
        { error: '토큰이 없습니다.' },
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

    // 사용자 정보 조회 (최신 정보 확인)
    const user = await GoogleSheetsService.getUserByLoginId(decoded.username);
    
    if (!user) {
      return NextResponse.json(
        { error: '사용자를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 개인 스프레드시트 ID가 없으면 찾기
    let personalSheetId = user.personalSheetId;
    if (!personalSheetId) {
      try {
        personalSheetId = await GoogleSheetsService.getPersonalSheetIdByName(user.name);
      } catch (error) {
        console.error('개인 스프레드시트 검색 실패:', error);
      }
    }

    const { hashedPassword, ...userWithoutPassword } = user;

    return NextResponse.json({
      user: {
        ...userWithoutPassword,
        personalSheetId: personalSheetId || '',
      },
    });

  } catch (error) {
    console.error('Token verification error:', error);
    return NextResponse.json(
      { error: '인증 확인 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}