import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { GoogleSheetsService } from '@/lib/googleSheets';

const JWT_SECRET = process.env.NEXTAUTH_SECRET || 'your-secret-key';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  console.log('=== 문서 미리보기 API 시작 ===');
  console.log('현재 시간:', new Date().toISOString());
  console.log('요청 URL:', request.url);
  console.log('params:', params);
  
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

    const documentId = params.id;
    console.log('받은 documentId:', documentId);

    // documentId에서 시트 ID와 행 번호 추출
    const [sheetId, rowIndexStr] = documentId.split('_');
    const rowIndex = parseInt(rowIndexStr);
    console.log('파싱된 정보:', { sheetId, rowIndex });

    if (!sheetId || isNaN(rowIndex)) {
      console.log('잘못된 documentId 형식');
      return NextResponse.json(
        { error: '유효하지 않은 문서 ID입니다.' },
        { status: 400 }
      );
    }

    // 1단계: 개인 스프레드시트에서 해당 행의 O열(문서링크) 가져오기
    console.log('개인 스프레드시트에서 문서링크 조회...');
    console.log('조회할 범위:', `A${rowIndex + 1}:O${rowIndex + 1}`);
    const personalSheetData = await GoogleSheetsService.getSheetData(sheetId, `A${rowIndex + 1}:O${rowIndex + 1}`);
    console.log('개인 시트 행 데이터:', JSON.stringify(personalSheetData, null, 2));

    if (!personalSheetData || personalSheetData.length === 0) {
      return NextResponse.json(
        { error: '문서 데이터를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    const documentLink = personalSheetData[0][14]; // O열 (0-based로 14번째)
    console.log('O열 문서링크:', documentLink);

    if (!documentLink) {
      return NextResponse.json(
        { error: '문서 링크가 없습니다.' },
        { status: 404 }
      );
    }

    // 2단계: O열 URL에서 스프레드시트 ID와 시트 GID 추출
    const urlMatch = documentLink.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    const gidMatch = documentLink.match(/gid=([0-9]+)/);
    
    if (!urlMatch) {
      return NextResponse.json(
        { error: '유효하지 않은 문서 링크입니다.' },
        { status: 400 }
      );
    }

    const actualDocumentId = urlMatch[1];
    const gid = gidMatch ? gidMatch[1] : null;
    console.log('실제 문서 ID:', actualDocumentId);
    console.log('시트 GID:', gid);

    // 실제 문서의 데이터 가져오기
    console.log('실제 문서 데이터 조회 시작...');
    let sheetData;
    
    if (gid) {
      // GID가 있으면 특정 시트의 A~K열만 가져오기
      sheetData = await GoogleSheetsService.getSheetDataByGid(actualDocumentId, gid, 'A1:K50');
    } else {
      // GID가 없으면 첫 번째 시트의 A~K열만 가져오기
      sheetData = await GoogleSheetsService.getSheetData(actualDocumentId, 'A1:K50');
    }
    
    console.log('조회된 실제 문서 데이터 행 수:', sheetData.length);

    return NextResponse.json({ 
      sheetData,
      documentId,
      originalSheetId: sheetId,
      actualDocumentId,
      gid,
      documentLink,
      rowIndex
    });

  } catch (error) {
    console.error('=== 문서 미리보기 API 오류 ===');
    console.error('오류 타입:', typeof error);
    console.error('오류 메시지:', error?.message);
    console.error('전체 오류:', error);
    
    return NextResponse.json(
      { 
        error: '문서 미리보기를 불러오는 중 오류가 발생했습니다.',
        details: error?.message 
      },
      { status: 500 }
    );
  }
}