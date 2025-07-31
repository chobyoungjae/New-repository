'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LoginForm } from '@/components/LoginForm';
import { LoginForm as LoginFormType } from '@/types';
import { useAuth } from '@/contexts/AuthContext';

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (formData: LoginFormType) => {
    setIsLoading(true);
    
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          loginId: formData.loginId,
          password: formData.password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '로그인에 실패했습니다.');
      }

      // 로그인 처리
      login(data.user);
      
      // JWT 토큰 저장 (선택적)
      if (data.token) {
        localStorage.setItem('token', data.token);
      }
      
      // 대시보드로 이동
      router.push('/dashboard');
      
    } catch (error: any) {
      console.error('Login failed:', error);
      throw new Error(error.message || '아이디 또는 비밀번호가 올바르지 않습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  return <LoginForm onSubmit={handleLogin} isLoading={isLoading} />;
}