import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { GoogleSheetsService } from '@/lib/googleSheets';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { loginId, password } = body;

    if (!loginId || !password) {
      return NextResponse.json(
        { error: '아이디와 비밀번호를 모두 입력해주세요.' },
        { status: 400 }
      );
    }

    // 사용자 조회
    const user = await GoogleSheetsService.getUserByLoginId(loginId);
    if (!user) {
      return NextResponse.json(
        { error: '아이디 또는 비밀번호가 올바르지 않습니다.' },
        { status: 401 }
      );
    }

    // 비밀번호 검증
    if (!user.hashedPassword) {
      return NextResponse.json(
        { error: '사용자 정보에 오류가 있습니다.' },
        { status: 500 }
      );
    }

    const isPasswordValid = await bcrypt.compare(password, user.hashedPassword);
    if (!isPasswordValid) {
      return NextResponse.json(
        { error: '아이디 또는 비밀번호가 올바르지 않습니다.' },
        { status: 401 }
      );
    }

    // 개인 스프레드시트가 없으면 기존 시트에서 찾기 (첫 로그인 시)
    let personalSheetId = user.personalSheetId;
    if (!personalSheetId) {
      console.log('개인 스프레드시트 ID가 없어서 검색 중...', user.name);
      try {
        personalSheetId = await GoogleSheetsService.getPersonalSheetIdByName(user.name);
        if (personalSheetId) {
          console.log('기존 개인 스프레드시트 찾음:', personalSheetId);
          // TODO: 메인 스프레드시트의 사용자 정보 업데이트 필요
        } else {
          console.log('개인 스프레드시트를 찾지 못했습니다.');
        }
      } catch (error) {
        console.error('개인 스프레드시트 검색 실패:', error);
        personalSheetId = '';
      }
    }

    // JWT 토큰 생성
    const token = jwt.sign(
      { 
        employeeNumber: user.employeeNumber,
        username: user.username,
        email: user.email,
      },
      process.env.NEXTAUTH_SECRET || 'fallback-secret',
      { expiresIn: '7d' }
    );

    // 로그인 성공 응답 (비밀번호 제외)
    const { hashedPassword, ...userWithoutPassword } = user;
    
    const response = NextResponse.json({
      message: '로그인 성공',
      user: {
        ...userWithoutPassword,
        personalSheetId, // 업데이트된 개인 스프레드시트 ID
      },
      token,
    }, { status: 200 });

    // JWT 토큰을 HttpOnly 쿠키로 설정
    response.cookies.set('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60, // 7일
      path: '/',
    });

    console.log('로그인 성공, 토큰 쿠키 설정 완료');
    return response;

  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: '로그인 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}