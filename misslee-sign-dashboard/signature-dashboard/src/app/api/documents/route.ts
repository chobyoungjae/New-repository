import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { GoogleSheetsService } from '@/lib/googleSheets';

const JWT_SECRET = process.env.NEXTAUTH_SECRET || 'your-secret-key';

export async function GET(request: NextRequest) {
  console.log('=== 문서 조회 API 시작 ===');
  try {
    // JWT 토큰 검증
    const token = request.cookies.get('token')?.value;
    console.log('토큰 존재 여부:', !!token);
    
    if (!token) {
      console.log('토큰이 없습니다');
      return NextResponse.json(
        { error: '인증이 필요합니다.' },
        { status: 401 }
      );
    }

    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET) as any;
      console.log('토큰 디코드 성공:', { username: decoded.username });
    } catch (error) {
      console.log('토큰 검증 실패:', error);
      return NextResponse.json(
        { error: '유효하지 않은 토큰입니다.' },
        { status: 401 }
      );
    }

    // 사용자의 개인 스프레드시트 ID 가져오기
    console.log('사용자 정보 조회 시작:', decoded.username);
    const user = await GoogleSheetsService.getUserByLoginId(decoded.username);
    console.log('조회된 사용자 정보:', {
      exists: !!user,
      personalSheetId: user?.personalSheetId,
      name: user?.name
    });
    
    if (!user) {
      console.log('사용자를 찾을 수 없습니다');
      return NextResponse.json(
        { error: '사용자 정보를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    if (!user.personalSheetId) {
      console.log('개인 스프레드시트 ID가 없습니다');
      return NextResponse.json(
        { error: '개인 스프레드시트가 설정되지 않았습니다. 관리자에게 문의하세요.' },
        { status: 404 }
      );
    }

    // 개인 스프레드시트에서 미서명 문서 조회
    console.log('문서 조회 시작, 스프레드시트 ID:', user.personalSheetId);
    const documents = await GoogleSheetsService.getUnsignedDocuments(user.personalSheetId);
    console.log('조회된 문서 개수:', documents.length);

    return NextResponse.json({ documents });
  } catch (error) {
    console.error('=== 문서 조회 API 오류 ===');
    console.error('오류 타입:', typeof error);
    console.error('오류 메시지:', error?.message);
    console.error('전체 오류:', error);
    console.error('스택 트레이스:', error?.stack);
    
    return NextResponse.json(
      { 
        error: '문서를 불러오는 중 오류가 발생했습니다.',
        details: error?.message 
      },
      { status: 500 }
    );
  }
}