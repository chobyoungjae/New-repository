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
    
    return NextResponse.json({
      message: '로그인 성공',
      user: userWithoutPassword,
      token,
    }, { status: 200 });

  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: '로그인 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}