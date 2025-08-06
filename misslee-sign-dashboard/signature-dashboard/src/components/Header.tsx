'use client';

import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { usePWA } from '@/hooks/usePWA';

export const Header: React.FC = () => {
  const { user, logout } = useAuth();
  const { isInstallable, installPWA } = usePWA();

  const handleLogout = () => {
    if (window.confirm('로그아웃하시겠습니까?')) {
      logout();
      window.location.href = '/login';
    }
  };

  const handleRefresh = () => {
    window.location.reload();
  };

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
      <div className="max-w-4xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          {/* 로고 및 제목 */}
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg">📝</span>
            </div>
            <h1 className="text-xl font-bold text-gray-900">
              서명 대시보드 - {user?.name}
            </h1>
          </div>

          {/* 사용자 정보 및 액션 */}
          <div className="flex items-center space-x-3">
            {/* PWA 설치 버튼 */}
            {isInstallable && (
              <button
                onClick={installPWA}
                className="hidden sm:flex items-center space-x-1 px-3 py-1.5 text-sm bg-blue-50 text-blue-700 rounded-md hover:bg-blue-100 transition-colors"
              >
                <span>📱</span>
                <span>앱 설치</span>
              </button>
            )}

            {/* 새로고침 버튼 */}
            <button
              onClick={handleRefresh}
              className="hidden sm:flex items-center space-x-1 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
              title="새로고침"
            >
              <span className="text-lg">🔄</span>
              <span>새로고침</span>
            </button>

            {/* 모바일 새로고침 버튼 */}
            <button
              onClick={handleRefresh}
              className="sm:hidden p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
              title="새로고침"
            >
              <span className="text-lg">🔄</span>
            </button>

            {/* 로그아웃 버튼 */}
            <button
              onClick={handleLogout}
              className="hidden sm:flex items-center space-x-2 px-3 py-1.5 text-sm text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
              title="로그아웃"
            >
              <img 
                src="/logout-icon.png" 
                alt="로그아웃" 
                className="w-5 h-5"
              />
              <span>로그아웃</span>
            </button>

            {/* 모바일 로그아웃 버튼 */}
            <button
              onClick={handleLogout}
              className="sm:hidden p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
              title="로그아웃"
            >
              <img 
                src="/logout-icon.png" 
                alt="로그아웃" 
                className="w-5 h-5"
              />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};