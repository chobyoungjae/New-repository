export interface User {
  employeeNumber: string; // EMP + 6자리 숫자
  name: string;
  username: string;
  email: string;
  password?: string;
  joinDate: string;
  lastLogin?: string;
  status: 'active' | 'inactive' | 'locked';
  personalSheetId?: string;
}

export interface Document {
  id: string;
  date: string; // yy.mm.dd 형식
  title: string;
  author: string;
  content: string;
  teamLeaderSignature?: string;
  reviewSignature?: string;
  ceoSignature?: string;
  isCompleted: boolean;
  documentLink?: string;
}

export interface RegisterForm {
  name: string;
  username: string;
  password: string;
  confirmPassword: string;
  email: string;
}

export interface LoginForm {
  loginId: string; // username 또는 email
  password: string;
}

export interface SignatureStatus {
  teamLeader: boolean;
  review: boolean;
  ceo: boolean;
}