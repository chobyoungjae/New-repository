import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { GoogleSheetsService } from '@/lib/googleSheets';

const JWT_SECRET = process.env.NEXTAUTH_SECRET || 'your-secret-key';

export async function POST(request: NextRequest) {
  console.log('=== 서명 API 시작 ===');
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

    // 요청 본문에서 documentId 추출
    const { documentId } = await request.json();
    console.log('받은 documentId:', documentId);
    
    if (!documentId) {
      console.log('documentId가 없습니다');
      return NextResponse.json(
        { error: '문서 ID가 필요합니다.' },
        { status: 400 }
      );
    }

    // 사용자의 개인 스프레드시트 ID 가져오기
    console.log('사용자 정보 조회 시작:', decoded.username);
    const user = await GoogleSheetsService.getUserByLoginId(decoded.username);
    console.log('조회된 사용자:', {
      exists: !!user,
      name: user?.name,
      personalSheetId: user?.personalSheetId
    });
    
    if (!user || !user.personalSheetId) {
      console.log('사용자 정보가 없습니다');
      return NextResponse.json(
        { error: '사용자 정보를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // documentId에서 시트 ID와 행 번호 추출 - 마지막 '_'로만 분할
    // documentId 형식: "{sheetId}_{rowIndex}"
    const lastUnderscoreIndex = documentId.lastIndexOf('_');
    const sheetId = documentId.substring(0, lastUnderscoreIndex);
    const rowIndexStr = documentId.substring(lastUnderscoreIndex + 1);
    const rowIndex = parseInt(rowIndexStr);
    console.log('파싱된 정보:', { sheetId, rowIndex, rowIndexStr });

    if (!sheetId || isNaN(rowIndex)) {
      console.log('잘못된 documentId 형식');
      return NextResponse.json(
        { error: '유효하지 않은 문서 ID입니다.' },
        { status: 400 }
      );
    }

    // 서명 완료 처리
    console.log('서명 완료 처리 시작...');
    await GoogleSheetsService.completeSignature(sheetId, rowIndex);
    console.log('서명 완료 처리 성공');

    return NextResponse.json({ 
      success: true, 
      message: '서명이 완료되었습니다.' 
    });
  } catch (error) {
    console.error('=== 서명 API 오류 ===');
    console.error('오류 타입:', typeof error);
    console.error('오류 메시지:', error?.message);
    console.error('전체 오류:', error);
    console.error('스택 트레이스:', error?.stack);
    
    return NextResponse.json(
      { 
        error: '서명 처리 중 오류가 발생했습니다.',
        details: error?.message 
      },
      { status: 500 }
    );
  }
}