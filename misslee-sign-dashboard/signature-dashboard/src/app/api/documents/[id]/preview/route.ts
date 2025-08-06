import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { GoogleSheetsService } from '@/lib/googleSheets';

const JWT_SECRET = process.env.NEXTAUTH_SECRET || 'your-secret-key';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET) as any;
      console.log('토큰 디코드 성공:', { username: decoded.username });
    } catch (error) {
      console.log('토큰 검증 실패:', error);
      return NextResponse.json({ error: '유효하지 않은 토큰입니다.' }, { status: 401 });
    }

    const { id: documentId } = await params;
    console.log('받은 documentId:', documentId);

    // documentId 형식 확인 및 파싱
    console.log('documentId 형식 분석:', { documentId, length: documentId.length });
    
    // Google Drive 파일 ID 형식인지 확인 (25자 이상의 영숫자+하이픈+언더스코어, '_'가 없거나 1개 이하)
    const underscoreCount = (documentId.match(/_/g) || []).length;
    const isGoogleDriveFileId = /^[a-zA-Z0-9_-]{25,}$/.test(documentId) && underscoreCount <= 1;
    
    if (isGoogleDriveFileId && !documentId.includes('_')) {
      // 직접 PDF 파일 ID인 경우
      console.log('직접 PDF 파일 ID로 판단:', documentId);
      
      return NextResponse.json({
        sheetData: [],
        documentId,
        originalSheetId: null,
        actualDocumentId: documentId,
        gid: null,
        documentLink: documentId,
        rowIndex: null,
        fileType: 'pdf',
        previewUrl: `https://drive.google.com/file/d/${documentId}/preview`,
      });
    }
    
    // 기존 형식 (sheetId_rowIndex) 파싱 - 마지막 '_'로만 분할
    const lastUnderscoreIndex = documentId.lastIndexOf('_');
    const sheetId = documentId.substring(0, lastUnderscoreIndex);
    const rowIndexStr = documentId.substring(lastUnderscoreIndex + 1);
    const rowIndex = parseInt(rowIndexStr);
    console.log('기존 형식으로 파싱된 정보:', { sheetId, rowIndex, rowIndexStr });

    if (!sheetId || isNaN(rowIndex)) {
      console.log('잘못된 documentId 형식');
      return NextResponse.json({ error: '유효하지 않은 문서 ID입니다.' }, { status: 400 });
    }

    // 1단계: 개인 스프레드시트에서 해당 행의 O열(문서링크) 가져오기
    console.log('개인 스프레드시트에서 문서링크 조회...');
    console.log('조회할 범위:', `A${rowIndex + 1}:O${rowIndex + 1}`);
    const personalSheetData = await GoogleSheetsService.getSheetData(
      sheetId,
      `A${rowIndex + 1}:O${rowIndex + 1}`
    );
    console.log('개인 시트 행 데이터:', JSON.stringify(personalSheetData, null, 2));

    if (!personalSheetData || personalSheetData.length === 0) {
      return NextResponse.json({ error: '문서 데이터를 찾을 수 없습니다.' }, { status: 404 });
    }

    const documentLink = personalSheetData[0][14]; // O열 (0-based로 14번째)
    console.log('O열 문서링크:', documentLink);

    if (!documentLink) {
      return NextResponse.json({ error: '문서 링크가 없습니다.' }, { status: 404 });
    }

    // 2단계: O열 값이 Google Sheets URL인지 PDF 파일 ID인지 판단
    const isGoogleSheetsUrl = documentLink.includes('/spreadsheets/d/');
    const isPdfFileId = /^[a-zA-Z0-9-_]{25,}$/.test(documentLink); // Google Drive 파일 ID 패턴

    console.log('문서 타입 판단:', {
      isGoogleSheetsUrl,
      isPdfFileId,
      documentLink,
    });

    let actualDocumentId = '';
    let gid = null;
    let fileType = 'spreadsheet';
    let previewUrl = '';

    if (isGoogleSheetsUrl) {
      // 기존 Google Sheets URL 처리
      const urlMatch = documentLink.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
      const gidMatch = documentLink.match(/gid=([0-9]+)/);

      if (!urlMatch) {
        return NextResponse.json({ error: '유효하지 않은 문서 링크입니다.' }, { status: 400 });
      }

      actualDocumentId = urlMatch[1];
      gid = gidMatch ? gidMatch[1] : null;
      fileType = 'spreadsheet';

      // Google Sheets 미리보기 URL 생성
      if (gid) {
        previewUrl = `https://docs.google.com/spreadsheets/d/${actualDocumentId}/edit?usp=sharing&gid=${gid}&rm=minimal&widget=true&chrome=false&headers=false`;
      } else {
        previewUrl = `https://docs.google.com/spreadsheets/d/${actualDocumentId}/edit?usp=sharing&rm=minimal&widget=true&chrome=false&headers=false`;
      }

      console.log('Google Sheets 문서 정보:', { actualDocumentId, gid, previewUrl });

      // 실제 문서의 데이터 가져오기 (전체 데이터 범위 자동 감지)
      console.log('실제 문서 데이터 조회 시작...');
      let sheetData;

      if (gid) {
        // GID가 있으면 특정 시트의 전체 데이터 가져오기 (최대 100행까지)
        sheetData = await GoogleSheetsService.getSheetDataByGid(actualDocumentId, gid, 'A:O');
      } else {
        // GID가 없으면 첫 번째 시트의 전체 데이터 가져오기 (최대 100행까지)
        sheetData = await GoogleSheetsService.getSheetData(actualDocumentId, 'A:O');
      }

      // 빈 행 제거 (모든 셀이 비어있는 행은 제외)
      const filteredData = sheetData.filter((row, index) => {
        // 첫 번째 행(헤더)은 항상 포함
        if (index === 0) return true;
        
        // 나머지 행은 최소 하나의 셀에 데이터가 있는 경우만 포함
        return row.some(cell => cell && cell.toString().trim() !== '');
      });

      console.log('조회된 실제 문서 데이터 행 수:', sheetData.length);
      console.log('필터링된 문서 데이터 행 수:', filteredData.length);

      return NextResponse.json({
        sheetData: filteredData,
        documentId,
        originalSheetId: sheetId,
        actualDocumentId,
        gid,
        documentLink,
        rowIndex,
        fileType,
        previewUrl,
      });
    } else if (isPdfFileId) {
      // PDF 파일 ID 처리
      actualDocumentId = documentLink;
      fileType = 'pdf';

      // Google Drive PDF 미리보기 URL 생성
      previewUrl = `https://drive.google.com/file/d/${actualDocumentId}/preview`;

      console.log('PDF 문서 정보:', { actualDocumentId, previewUrl });

      return NextResponse.json({
        sheetData: [], // PDF는 스프레드시트 데이터가 없음
        documentId,
        originalSheetId: sheetId,
        actualDocumentId,
        gid: null,
        documentLink,
        rowIndex,
        fileType,
        previewUrl,
      });
    } else {
      // 지원하지 않는 형식
      return NextResponse.json(
        {
          error:
            '지원하지 않는 문서 형식입니다. Google Sheets URL 또는 PDF 파일 ID를 사용해주세요.',
        },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('=== 문서 미리보기 API 오류 ===');
    console.error('오류 타입:', typeof error);
    console.error('오류 메시지:', error?.message);
    console.error('전체 오류:', error);

    return NextResponse.json(
      {
        error: '문서 미리보기를 불러오는 중 오류가 발생했습니다.',
        details: error?.message,
      },
      { status: 500 }
    );
  }
}
