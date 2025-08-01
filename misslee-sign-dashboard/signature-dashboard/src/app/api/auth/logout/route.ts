import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const response = NextResponse.json({
      message: '로그아웃되었습니다.',
    }, { status: 200 });

    // 토큰 쿠키 제거
    response.cookies.delete('token');
    
    console.log('로그아웃 완료, 토큰 쿠키 삭제');
    return response;

  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json(
      { error: '로그아웃 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}