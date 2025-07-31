'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Header } from '@/components/Header';
import { DocumentCard } from '@/components/DocumentCard';
import { Document } from '@/types';

export default function DashboardPage() {
  const { user, isAuthenticated } = useAuth();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 임시 테스트 데이터 (실제로는 Google Sheets API에서 가져옴)
  const mockDocuments: Document[] = [
    {
      id: '1',
      date: '25.01.30',
      title: '월간 보고서',
      author: '김철수',
      content: '1월 매출 보고서 승인 요청입니다. 전월 대비 15% 증가한 실적을 보이고 있습니다.',
      teamLeaderSignature: 'signed',
      reviewSignature: 'signed',
      ceoSignature: undefined,
      isCompleted: false,
      documentLink: 'https://docs.google.com/spreadsheets/d/example1'
    },
    {
      id: '2',
      date: '25.01.29',
      title: '휴가 신청서',
      author: '이영희',
      content: '2월 둘째 주 연차휴가 신청합니다. (2/10~2/12, 3일간)',
      teamLeaderSignature: undefined,
      reviewSignature: undefined,
      ceoSignature: undefined,
      isCompleted: false,
      documentLink: 'https://docs.google.com/spreadsheets/d/example2'
    },
    {
      id: '3',
      date: '25.01.28',
      title: '프로젝트 제안서',
      author: '박민수',
      content: '신규 프로젝트 "Smart Dashboard" 개발 제안서입니다. 예상 개발기간 3개월, 예산 5천만원.',
      teamLeaderSignature: 'signed',
      reviewSignature: undefined,
      ceoSignature: undefined,
      isCompleted: false,
      documentLink: 'https://docs.google.com/spreadsheets/d/example3'
    }
  ];

  useEffect(() => {
    if (!isAuthenticated) {
      window.location.href = '/login';
      return;
    }

    // 실제로는 Google Sheets API 호출
    const fetchDocuments = async () => {
      try {
        setIsLoading(true);
        // TODO: 실제 API 호출로 대체
        // const response = await fetch('/api/documents');
        // const data = await response.json();
        
        // 임시로 모크 데이터 사용
        await new Promise(resolve => setTimeout(resolve, 1000)); // 로딩 시뮬레이션
        setDocuments(mockDocuments);
      } catch (err) {
        setError('문서를 불러오는 중 오류가 발생했습니다.');
        console.error('Error fetching documents:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDocuments();
  }, [isAuthenticated]);

  const handleSignature = async (documentId: string) => {
    try {
      // TODO: 실제 Google Sheets API 호출
      // await fetch('/api/documents/sign', {
      //   method: 'POST',
      //   body: JSON.stringify({ documentId })
      // });

      // 임시로 로컬 상태 업데이트
      setDocuments(prev => 
        prev.map(doc => 
          doc.id === documentId 
            ? { ...doc, isCompleted: true }
            : doc
        ).filter(doc => !doc.isCompleted) // 완료된 문서는 목록에서 제거
      );

      alert('서명이 완료되었습니다!');
    } catch (error) {
      alert('서명 처리 중 오류가 발생했습니다.');
      console.error('Signature error:', error);
    }
  };

  if (!isAuthenticated) {
    return null; // 로딩 또는 리디렉션 중
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <main className="max-w-4xl mx-auto px-4 py-6">
        {/* 대시보드 헤더 */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            미서명 문서 ({documents.length}건)
          </h2>
          <p className="text-gray-600">
            서명이 필요한 문서들을 확인하고 처리하세요.
          </p>
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
              <div className="space-y-4">
                {documents.map((document) => (
                  <DocumentCard
                    key={document.id}
                    document={document}
                    onSignature={handleSignature}
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