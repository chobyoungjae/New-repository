export const validateUsername = (username: string): { isValid: boolean; message: string } => {
  if (username.length < 5 || username.length > 20) {
    return { isValid: false, message: '아이디는 5-20자 사이여야 합니다.' };
  }
  
  const regex = /^[a-zA-Z0-9]+$/;
  if (!regex.test(username)) {
    return { isValid: false, message: '아이디는 영문과 숫자만 사용 가능합니다.' };
  }
  
  return { isValid: true, message: '' };
};

export const validatePassword = (password: string): { isValid: boolean; message: string } => {
  if (password.length < 8) {
    return { isValid: false, message: '비밀번호는 8자 이상이어야 합니다.' };
  }
  
  const hasLetter = /[a-zA-Z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);
  
  if (!hasLetter || !hasNumber || !hasSpecial) {
    return { 
      isValid: false, 
      message: '비밀번호는 영문, 숫자, 특수문자를 모두 포함해야 합니다.' 
    };
  }
  
  return { isValid: true, message: '' };
};

export const validateEmail = (email: string): { isValid: boolean; message: string } => {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!regex.test(email)) {
    return { isValid: false, message: '올바른 이메일 형식이 아닙니다.' };
  }
  
  return { isValid: true, message: '' };
};

export const validateName = (name: string): { isValid: boolean; message: string } => {
  if (name.trim().length < 2) {
    return { isValid: false, message: '이름은 2자 이상이어야 합니다.' };
  }
  
  return { isValid: true, message: '' };
};