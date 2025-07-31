'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { RegisterForm } from '@/components/RegisterForm';
import { RegisterForm as RegisterFormType } from '@/types';

export default function RegisterPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const handleRegister = async (formData: RegisterFormType & { employeeNumber: string }) => {
    setIsLoading(true);
    
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name,
          username: formData.username,
          password: formData.password,
          email: formData.email,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '회원가입에 실패했습니다.');
      }

      // 성공 시 로그인 페이지로 이동
      alert(`회원가입이 완료되었습니다! 사원번호: ${data.user.employeeNumber}`);
      router.push('/login');
      
    } catch (error: any) {
      console.error('Registration failed:', error);
      alert(error.message || '회원가입 중 오류가 발생했습니다. 다시 시도해주세요.');
    } finally {
      setIsLoading(false);
    }
  };

  return <RegisterForm onSubmit={handleRegister} isLoading={isLoading} />;
}