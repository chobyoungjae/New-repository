import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fileId = searchParams.get('fileId');

    if (!fileId) {
      return NextResponse.json({ error: '파일 ID가 필요합니다.' }, { status: 400 });
    }

    // Google Drive 공개 다운로드 URL
    const driveUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
    
    console.log('PDF 프록시 요청:', driveUrl);

    // Google Drive에서 PDF 파일 가져오기
    const response = await fetch(driveUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!response.ok) {
      console.error('Google Drive 응답 오류:', response.status, response.statusText);
      return NextResponse.json({ 
        error: `PDF 파일을 가져올 수 없습니다. (${response.status})` 
      }, { status: response.status });
    }

    // PDF 데이터 가져오기
    const pdfBuffer = await response.arrayBuffer();
    
    console.log('PDF 파일 크기:', pdfBuffer.byteLength, 'bytes');

    // PDF 응답 반환
    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="document.pdf"`,
        'Cache-Control': 'public, max-age=3600', // 1시간 캐시
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });

  } catch (error) {
    console.error('PDF 프록시 오류:', error);
    return NextResponse.json(
      { 
        error: 'PDF 파일을 불러오는 중 오류가 발생했습니다.',
        details: error?.message 
      },
      { status: 500 }
    );
  }
}