import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { GoogleSheetsService } from '@/lib/googleSheets';
import { generateEmployeeNumber } from '@/utils/employee';
import { validateUsername, validatePassword, validateEmail, validateName } from '@/utils/validation';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, username, password, email } = body;

    // 입력값 유효성 검증
    const nameValidation = validateName(name);
    if (!nameValidation.isValid) {
      return NextResponse.json({ error: nameValidation.message }, { status: 400 });
    }

    const usernameValidation = validateUsername(username);
    if (!usernameValidation.isValid) {
      return NextResponse.json({ error: usernameValidation.message }, { status: 400 });
    }

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
      return NextResponse.json({ error: passwordValidation.message }, { status: 400 });
    }

    const emailValidation = validateEmail(email);
    if (!emailValidation.isValid) {
      return NextResponse.json({ error: emailValidation.message }, { status: 400 });
    }

    // 중복 확인
    const usernameExists = await GoogleSheetsService.checkUsernameExists(username);
    if (usernameExists) {
      return NextResponse.json({ error: '이미 사용 중인 아이디입니다.' }, { status: 400 });
    }

    const emailExists = await GoogleSheetsService.checkEmailExists(email);
    if (emailExists) {
      return NextResponse.json({ error: '이미 사용 중인 이메일입니다.' }, { status: 400 });
    }

    // 사원번호 생성
    const lastEmployeeNumber = await GoogleSheetsService.getLastEmployeeNumber();
    const employeeNumber = generateEmployeeNumber(lastEmployeeNumber);

    // 비밀번호 해시화
    const hashedPassword = await bcrypt.hash(password, 12);

    // 개인 스프레드시트 생성
    const personalSheetId = await GoogleSheetsService.createPersonalSheet(employeeNumber);

    // 사용자 생성
    await GoogleSheetsService.createUser({
      employeeNumber,
      name,
      username,
      email,
      personalSheetId,
      hashedPassword,
    });

    // 비밀번호는 응답에서 제외
    return NextResponse.json({
      message: '회원가입이 완료되었습니다.',
      user: {
        employeeNumber,
        name,
        username,
        email,
        personalSheetId,
      },
    }, { status: 201 });

  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { error: '회원가입 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}