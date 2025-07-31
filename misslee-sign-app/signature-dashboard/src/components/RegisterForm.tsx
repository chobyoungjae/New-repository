'use client';

import React, { useState } from 'react';
import { RegisterForm as RegisterFormType } from '@/types';
import { validateUsername, validatePassword, validateEmail, validateName } from '@/utils/validation';
import { generateEmployeeNumber } from '@/utils/employee';

interface RegisterFormProps {
  onSubmit: (formData: RegisterFormType & { employeeNumber: string }) => Promise<void>;
  isLoading?: boolean;
}

export const RegisterForm: React.FC<RegisterFormProps> = ({ onSubmit, isLoading = false }) => {
  const [formData, setFormData] = useState<RegisterFormType>({
    name: '',
    username: '',
    password: '',
    confirmPassword: '',
    email: '',
  });

  const [errors, setErrors] = useState<Partial<RegisterFormType>>({});
  const [touched, setTouched] = useState<Partial<Record<keyof RegisterFormType, boolean>>>({});

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // 실시간 유효성 검사
    if (touched[name as keyof RegisterFormType]) {
      validateField(name as keyof RegisterFormType, value);
    }
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setTouched(prev => ({ ...prev, [name]: true }));
    validateField(name as keyof RegisterFormType, value);
  };

  const validateField = (field: keyof RegisterFormType, value: string) => {
    let error = '';

    switch (field) {
      case 'name':
        const nameValidation = validateName(value);
        error = nameValidation.isValid ? '' : nameValidation.message;
        break;
      case 'username':
        const usernameValidation = validateUsername(value);
        error = usernameValidation.isValid ? '' : usernameValidation.message;
        break;
      case 'password':
        const passwordValidation = validatePassword(value);
        error = passwordValidation.isValid ? '' : passwordValidation.message;
        break;
      case 'confirmPassword':
        error = value !== formData.password ? '비밀번호가 일치하지 않습니다.' : '';
        break;
      case 'email':
        const emailValidation = validateEmail(value);
        error = emailValidation.isValid ? '' : emailValidation.message;
        break;
    }

    setErrors(prev => ({ ...prev, [field]: error }));
  };

  const validateForm = (): boolean => {
    const newErrors: Partial<RegisterFormType> = {};

    const nameValidation = validateName(formData.name);
    if (!nameValidation.isValid) newErrors.name = nameValidation.message;

    const usernameValidation = validateUsername(formData.username);
    if (!usernameValidation.isValid) newErrors.username = usernameValidation.message;

    const passwordValidation = validatePassword(formData.password);
    if (!passwordValidation.isValid) newErrors.password = passwordValidation.message;

    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = '비밀번호가 일치하지 않습니다.';
    }

    const emailValidation = validateEmail(formData.email);
    if (!emailValidation.isValid) newErrors.email = emailValidation.message;

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    try {
      const employeeNumber = generateEmployeeNumber();
      await onSubmit({ ...formData, employeeNumber });
    } catch (error) {
      console.error('Registration failed:', error);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-900">회원가입</h2>
          <p className="mt-2 text-sm text-gray-600">서명 대시보드에 가입하세요</p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            {/* 이름 */}
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                이름 *
              </label>
              <input
                id="name"
                name="name"
                type="text"
                required
                value={formData.name}
                onChange={handleChange}
                onBlur={handleBlur}
                className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.name ? 'border-red-300 focus:ring-red-500' : 'border-gray-300'
                }`}
                placeholder="실명을 입력하세요"
              />
              {errors.name && (
                <p className="mt-1 text-sm text-red-600">{errors.name}</p>
              )}
            </div>

            {/* 아이디 */}
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-700">
                아이디 *
              </label>
              <input
                id="username"
                name="username"
                type="text"
                required
                value={formData.username}
                onChange={handleChange}
                onBlur={handleBlur}
                className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.username ? 'border-red-300 focus:ring-red-500' : 'border-gray-300'
                }`}
                placeholder="영문, 숫자 5-20자"
              />
              {errors.username && (
                <p className="mt-1 text-sm text-red-600">{errors.username}</p>
              )}
            </div>

            {/* 비밀번호 */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                비밀번호 *
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                value={formData.password}
                onChange={handleChange}
                onBlur={handleBlur}
                className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.password ? 'border-red-300 focus:ring-red-500' : 'border-gray-300'
                }`}
                placeholder="영문, 숫자, 특수문자 포함 8자 이상"
              />
              {errors.password && (
                <p className="mt-1 text-sm text-red-600">{errors.password}</p>
              )}
            </div>

            {/* 비밀번호 확인 */}
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
                비밀번호 확인 *
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                required
                value={formData.confirmPassword}
                onChange={handleChange}
                onBlur={handleBlur}
                className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.confirmPassword ? 'border-red-300 focus:ring-red-500' : 'border-gray-300'
                }`}
                placeholder="비밀번호를 다시 입력하세요"
              />
              {errors.confirmPassword && (
                <p className="mt-1 text-sm text-red-600">{errors.confirmPassword}</p>
              )}
            </div>

            {/* 이메일 */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                이메일 *
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                value={formData.email}
                onChange={handleChange}
                onBlur={handleBlur}
                className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.email ? 'border-red-300 focus:ring-red-500' : 'border-gray-300'
                }`}
                placeholder="example@email.com"
              />
              {errors.email && (
                <p className="mt-1 text-sm text-red-600">{errors.email}</p>
              )}
            </div>
          </div>

          <div className="flex flex-col space-y-4">
            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? '가입 처리 중...' : '회원가입'}
            </button>

            <div className="text-center">
              <a href="/login" className="text-sm text-blue-600 hover:text-blue-500">
                이미 계정이 있으신가요? 로그인하기
              </a>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};