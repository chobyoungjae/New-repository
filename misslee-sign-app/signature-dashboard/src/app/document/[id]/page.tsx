'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Document } from '@/types';

export default function DocumentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();
  const [document, setDocument] = useState<Document | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSigning, setIsSigning] = useState(false);

  // 임시 문서 데이터 (실제로는 API에서 가져옴)
  const mockDocuments: Record<string, Document> = {
    '1': {
      id: '1',
      date: '25.01.30',
      title: '월간 보고서',
      author: '김철수',
      content: '1월 매출 보고서 승인 요청입니다. 전월 대비 15% 증가한 실적을 보이고 있습니다. 주요 성과 지표들이 모두 목표치를 상회하였으며, 특히 신규 고객 유치 부분에서 뛰어난 성과를 보였습니다.',
      teamLeaderSignature: 'signed',
      reviewSignature: 'signed',
      ceoSignature: undefined,
      isCompleted: false,
      documentLink: 'https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit'
    },
    '2': {
      id: '2',
      date: '25.01.29',
      title: '휴가 신청서',
      author: '이영희',
      content: '2월 둘째 주 연차휴가 신청합니다. (2/10~2/12, 3일간) 개인 사정으로 인한 휴가이며, 업무 인수인계는 박민수 대리에게 완료하였습니다.',
      teamLeaderSignature: undefined,
      reviewSignature: undefined,
      ceoSignature: undefined,
      isCompleted: false,
      documentLink: 'https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit'
    },
    '3': {
      id: '3',
      date: '25.01.28',
      title: '프로젝트 제안서',
      author: '박민수',
      content: '신규 프로젝트 "Smart Dashboard" 개발 제안서입니다. 예상 개발기간 3개월, 예산 5천만원. 최신 기술 스택을 활용하여 사용자 경험을 크게 개선할 수 있을 것으로 예상됩니다.',
      teamLeaderSignature: 'signed',
      reviewSignature: undefined,
      ceoSignature: undefined,
      isCompleted: false,
      documentLink: 'https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit'
    }
  };

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }

    const documentId = params.id as string;
    
    // 실제로는 API 호출
    const fetchDocument = async () => {
      try {
        setIsLoading(true);
        
        // TODO: 실제 API 호출
        // const response = await fetch(`/api/documents/${documentId}`);
        // const data = await response.json();
        
        await new Promise(resolve => setTimeout(resolve, 500)); // 로딩 시뮬레이션
        const doc = mockDocuments[documentId];
        
        if (!doc) {
          throw new Error('문서를 찾을 수 없습니다.');
        }
        
        setDocument(doc);
      } catch (error) {
        console.error('Error fetching document:', error);
        alert('문서를 불러오는 중 오류가 발생했습니다.');
        router.push('/dashboard');
      } finally {
        setIsLoading(false);
      }
    };

    fetchDocument();
  }, [params.id, isAuthenticated, router]);

  const handleSignature = async () => {
    if (!document) return;
    
    const confirmMessage = `"${document.title}" 문서에 서명하시겠습니까?`;
    if (!window.confirm(confirmMessage)) return;

    setIsSigning(true);
    
    try {
      // TODO: 실제 API 호출
      // await fetch('/api/documents/sign', {
      //   method: 'POST',
      //   body: JSON.stringify({ documentId: document.id })
      // });

      await new Promise(resolve => setTimeout(resolve, 1000)); // 서명 처리 시뮬레이션
      
      alert('서명이 완료되었습니다!');
      router.push('/dashboard');
      
    } catch (error) {
      console.error('Signature error:', error);
      alert('서명 처리 중 오류가 발생했습니다.');
    } finally {
      setIsSigning(false);
    }
  };

  const handleBack = () => {
    router.push('/dashboard');
  };

  if (!isAuthenticated) return null;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">문서를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (!document) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="text-6xl mb-4">📄</div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            문서를 찾을 수 없습니다
          </h2>
          <button
            onClick={handleBack}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            대시보드로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={handleBack}
                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
                title="뒤로가기"
              >
                <span className="text-xl">←</span>
              </button>
              <div>
                <h1 className="text-xl font-bold text-gray-900">{document.title}</h1>
                <p className="text-sm text-gray-600">
                  작성자: {document.author} | {document.date}
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600">
                {user?.name} ({user?.employeeNumber})
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 메인 컨텐츠 */}
      <div className="max-w-6xl mx-auto p-4">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          
          {/* 문서 뷰어 (80% 너비) */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
              <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold text-gray-900">📋 문서 미리보기</h2>
                  {document.documentLink && (
                    <a
                      href={document.documentLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:text-blue-700"
                    >
                      🔗 원본 열기
                    </a>
                  )}
                </div>
              </div>
              
              {document.documentLink ? (
                <div className="relative">
                  <iframe
                    src={document.documentLink}
                    className="w-full h-96 md:h-[500px] lg:h-[600px]"
                    title={document.title}
                    frameBorder="0"
                  />
                  <div className="absolute inset-0 bg-white bg-opacity-0 pointer-events-none"></div>
                </div>
              ) : (
                <div className="p-8 text-center text-gray-500">
                  <div className="text-4xl mb-4">📄</div>
                  <p>문서 링크가 없습니다.</p>
                </div>
              )}
            </div>

            {/* 문서 내용 */}
            <div className="mt-6 bg-white rounded-lg border border-gray-200 shadow-sm p-6">
              <h3 className="font-semibold text-gray-900 mb-3">📝 문서 내용</h3>
              <p className="text-gray-700 leading-relaxed">{document.content}</p>
            </div>
          </div>

          {/* 사이드바 (20% 너비) */}
          <div className="lg:col-span-1 space-y-6">
            
            {/* 서명 현황 */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
              <h3 className="font-semibold text-gray-900 mb-4">✍️ 서명 현황</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">팀장</span>
                  <span className={`text-lg ${document.teamLeaderSignature ? 'text-green-500' : 'text-gray-300'}`}>
                    {document.teamLeaderSignature ? '✅' : '⏳'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">검토</span>
                  <span className={`text-lg ${document.reviewSignature ? 'text-green-500' : 'text-gray-300'}`}>
                    {document.reviewSignature ? '✅' : '⏳'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">대표</span>
                  <span className={`text-lg ${document.ceoSignature ? 'text-green-500' : 'text-gray-300'}`}>
                    {document.ceoSignature ? '✅' : '⏳'}
                  </span>
                </div>
              </div>
            </div>

            {/* 문서 정보 */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
              <h3 className="font-semibold text-gray-900 mb-4">📋 문서 정보</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">문서ID:</span>
                  <span className="text-gray-900">{document.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">생성일:</span>
                  <span className="text-gray-900">{document.date}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">작성자:</span>
                  <span className="text-gray-900">{document.author}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">상태:</span>
                  <span className={`${document.isCompleted ? 'text-green-600' : 'text-yellow-600'}`}>
                    {document.isCompleted ? '완료' : '대기중'}
                  </span>
                </div>
              </div>
            </div>

            {/* 서명 버튼 */}
            {!document.isCompleted && (
              <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
                <button
                  onClick={handleSignature}
                  disabled={isSigning}
                  className="w-full bg-green-600 text-white py-3 px-4 rounded-md font-medium hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSigning ? (
                    <div className="flex items-center justify-center space-x-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>서명 처리 중...</span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center space-x-2">
                      <span>✍️</span>
                      <span>서명하기</span>
                    </div>
                  )}
                </button>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}