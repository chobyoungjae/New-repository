'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Header } from '@/components/Header';
import { DocumentCard } from '@/components/DocumentCard';
import { Document } from '@/types';

export default function DashboardPage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [signingDocumentId, setSigningDocumentId] = useState<string | null>(null);


  useEffect(() => {
    // 인증 로딩 중이면 대기
    if (authLoading) {
      return;
    }
    
    // 인증 확인이 완료되고 인증되지 않은 경우에만 리디렉션
    if (!isAuthenticated) {
      window.location.href = '/login';
      return;
    }

    // Google Sheets API 호출
    const fetchDocuments = async () => {
      try {
        setIsLoading(true);
        const response = await fetch('/api/documents');
        
        if (!response.ok) {
          if (response.status === 401) {
            window.location.href = '/login';
            return;
          }
          throw new Error('문서를 불러오는데 실패했습니다.');
        }
        
        const data = await response.json();
        setDocuments(data.documents || []);
      } catch (err) {
        setError('문서를 불러오는 중 오류가 발생했습니다.');
        console.error('Error fetching documents:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDocuments();
  }, [isAuthenticated, authLoading]);

  const handleSignature = async (documentId: string) => {
    try {
      // 서명 중 상태로 설정
      setSigningDocumentId(documentId);
      
      const response = await fetch('/api/documents/sign', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ documentId })
      });

      if (!response.ok) {
        if (response.status === 401) {
          window.location.href = '/login';
          return;
        }
        throw new Error('서명 처리에 실패했습니다.');
      }

      // 성공 시 문서 목록에서 제거
      setDocuments(prev => 
        prev.filter(doc => doc.id !== documentId)
      );

      alert('서명이 완료되었습니다!');
    } catch (error) {
      alert('서명 처리 중 오류가 발생했습니다.');
      console.error('Signature error:', error);
    } finally {
      // 서명 완료 후 상태 초기화
      setSigningDocumentId(null);
    }
  };

  // 인증 로딩 중이거나 인증되지 않은 경우
  if (authLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">
            {authLoading ? '인증 확인 중...' : '로그인 페이지로 이동 중...'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <main className="max-w-4xl mx-auto px-4 py-6">
        {/* 대시보드 헤더 */}
        <div className="mb-4">
          <h2 className="text-2xl font-bold text-gray-900 mb-1">
            미서명 문서({documents.length}건)
          </h2>
        </div>

        {/* 로딩 상태 */}
        {isLoading && (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">문서를 불러오는 중...</p>
          </div>
        )}

        {/* 에러 상태 */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md mb-6">
            {error}
          </div>
        )}

        {/* 문서 목록 */}
        {!isLoading && !error && (
          <>
            {documents.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">🎉</div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  모든 서명이 완료되었습니다!
                </h3>
                <p className="text-gray-600">
                  현재 서명이 필요한 문서가 없습니다.
                </p>
              </div>
            ) : (
              <div className="space-y-3 sm:space-y-4">
                {documents.map((document) => (
                  <DocumentCard
                    key={document.id}
                    document={document}
                    onSignature={handleSignature}
                    isSigningInProgress={signingDocumentId === document.id}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {/* 플로팅 새로고침 버튼 (모바일) */}
        <button
          onClick={() => window.location.reload()}
          className="fixed bottom-6 right-6 bg-blue-600 text-white p-3 rounded-full shadow-lg hover:bg-blue-700 transition-colors sm:hidden"
          title="새로고침"
        >
          <span className="text-xl">🔄</span>
        </button>
      </main>
    </div>
  );
}