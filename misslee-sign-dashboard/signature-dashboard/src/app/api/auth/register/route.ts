import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { GoogleSheetsService } from '@/lib/googleSheets';
import { generateEmployeeNumber } from '@/utils/employee';
import { validateUsername, validatePassword, validateEmail, validateName } from '@/utils/validation';

export async function POST(request: NextRequest) {
  console.log('=== 회원가입 API 시작 ===');
  try {
    const body = await request.json();
    const { name, username, password, email } = body;
    console.log('받은 데이터:', { name, username, email });

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

    console.log('유효성 검증 완료');

    // 중복 확인
    console.log('중복 확인 시작...');
    const usernameExists = await GoogleSheetsService.checkUsernameExists(username);
    if (usernameExists) {
      console.log('아이디 중복:', username);
      return NextResponse.json({ error: '이미 사용 중인 아이디입니다.' }, { status: 400 });
    }

    const emailExists = await GoogleSheetsService.checkEmailExists(email);
    if (emailExists) {
      console.log('이메일 중복:', email);
      return NextResponse.json({ error: '이미 사용 중인 이메일입니다.' }, { status: 400 });
    }
    console.log('중복 확인 완료');

    // 사원번호 생성
    console.log('사원번호 생성 시작...');
    const lastEmployeeNumber = await GoogleSheetsService.getLastEmployeeNumber();
    const employeeNumber = generateEmployeeNumber(lastEmployeeNumber);
    console.log('생성된 사원번호:', employeeNumber);

    // 비밀번호 해시화
    console.log('비밀번호 해시화 시작...');
    const hashedPassword = await bcrypt.hash(password, 12);
    console.log('비밀번호 해시화 완료');

    // 기존 개인 스프레드시트 ID 찾기
    console.log('기존 개인 스프레드시트 ID 검색 중...');
    const personalSheetId = await GoogleSheetsService.getPersonalSheetIdByName(name);
    
    if (personalSheetId) {
      console.log('기존 개인 스프레드시트 찾음:', personalSheetId);
    } else {
      console.log('개인 스프레드시트를 찾지 못했습니다. 빈 값으로 저장합니다.');
    }

    // 사용자 생성
    console.log('사용자 데이터 저장 시작...');
    await GoogleSheetsService.createUser({
      employeeNumber,
      name,
      username,
      email,
      personalSheetId: personalSheetId || '', // 찾지 못하면 빈 값
      hashedPassword,
    });
    console.log('사용자 데이터 저장 완료');

    // 비밀번호는 응답에서 제외
    return NextResponse.json({
      message: '회원가입이 완료되었습니다.',
      user: {
        employeeNumber,
        name,
        username,
        email,
        personalSheetId: personalSheetId || '',
      },
    }, { status: 201 });

  } catch (error) {
    console.error('=== 회원가입 오류 상세 정보 ===');
    console.error('오류 타입:', error?.constructor?.name);
    console.error('오류 메시지:', error?.message);
    console.error('전체 오류:', error);
    console.error('스택 트레이스:', error?.stack);
    return NextResponse.json(
      { error: '회원가입 중 오류가 발생했습니다.', details: error?.message },
      { status: 500 }
    );
  }
}