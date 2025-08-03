'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Document } from '@/types';
import PDFViewer from '@/components/PDFViewer';

export default function DocumentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [sheetData, setSheetData] = useState<any[][]>([]);
  const [documentInfo, setDocumentInfo] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSigning, setIsSigning] = useState(false);
  const [error, setError] = useState<string | null>(null);


  useEffect(() => {
    // 인증 로딩 중이면 대기
    if (authLoading) {
      return;
    }

    // 인증되지 않은 경우 로그인 페이지로 이동
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }

    const documentId = params.id as string;

    // 실제 API 호출로 문서 미리보기 데이터 가져오기
    const fetchDocumentPreview = async () => {
      try {
        setIsLoading(true);
        console.log('문서 미리보기 요청:', documentId);

        const response = await fetch(`/api/documents/${documentId}/preview`);

        if (!response.ok) {
          if (response.status === 401) {
            router.push('/login');
            return;
          }
          const errorData = await response.json().catch(() => ({}));
          console.error('API 오류 응답:', errorData);
          throw new Error(
            errorData.error || `문서를 불러오는데 실패했습니다. (${response.status})`
          );
        }

        const data = await response.json();
        console.log('문서 데이터:', data);

        setSheetData(data.sheetData || []);
        setDocumentInfo(data);
      } catch (err) {
        console.error('=== 클라이언트 문서 미리보기 오류 ===');
        console.error('오류 객체:', err);
        console.error('오류 메시지:', (err as Error)?.message);
        console.error('오류 스택:', (err as Error)?.stack);

        const errorMessage = (err as Error)?.message || '문서를 불러오는 중 오류가 발생했습니다.';
        setError(errorMessage);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDocumentPreview();
  }, [params.id, isAuthenticated, authLoading, router]);

  const handleSignature = async () => {
    if (!documentInfo) return;

    const confirmMessage = `문서에 서명하시겠습니까?`;
    if (!window.confirm(confirmMessage)) return;

    setIsSigning(true);

    try {
      const response = await fetch('/api/documents/sign', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ documentId: documentInfo.documentId }),
      });

      if (!response.ok) {
        throw new Error('서명 처리에 실패했습니다.');
      }

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

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="text-6xl mb-4">📄</div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">문서 오류</h2>
          <p className="text-gray-600 mb-4">{error}</p>
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
    <>
      <style jsx global>{`
        
        /* 인쇄용 스타일 */
        @media print {
          body {
            margin: 0;
            font-family: Arial, sans-serif;
          }
          .document-preview table {
            font-size: 11px;
            page-break-inside: avoid;
            width: 100%;
          }
          .document-preview td {
            padding: 3px;
            font-size: 10px;
          }
          /* 사이드바 숨기기 */
          .lg\\:col-span-1 {
            display: none !important;
          }
          /* 메인 컨텐츠 전체 너비로 */
          .lg\\:col-span-3 {
            grid-column: span 4 / span 4;
          }
          /* 헤더 간소화 */
          .bg-gray-50 {
            background: white !important;
          }
        }
      `}</style>
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
                <h1 className="text-xl font-bold text-gray-900">문서 미리보기</h1>
                <p className="text-sm text-gray-600">
                  {documentInfo?.fileType === 'pdf'
                    ? 'PDF 문서'
                    : `Google Sheets 데이터 (${sheetData.length}행)`}
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
      <div className="max-w-6xl mx-auto p-2 md:p-4">
        <div className="flex flex-col lg:grid lg:grid-cols-4 gap-4 lg:gap-6">
          {/* 서명하기 버튼 - 모바일에서 상단으로 이동 */}
          <div className="lg:hidden order-first">
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-3">
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
          </div>

          {/* 문서 뷰어 */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
              <div className="hidden md:block bg-gray-50 px-4 py-3 border-b border-gray-200">
                <div className="flex items-center justify-end">
                  <button
                    onClick={() => window.print()}
                    className="text-sm text-blue-600 hover:text-blue-700"
                  >
                    🖨️ 인쇄
                  </button>
                </div>
              </div>

              <div className="p-2 md:p-6">
                {documentInfo?.fileType === 'pdf' && documentInfo?.actualDocumentId ? (
                  // PDF 파일 미리보기 (React PDF 뷰어 사용)
                  <PDFViewer 
                    fileId={documentInfo.actualDocumentId} 
                    title={`PDF 문서`}
                  />
                ) : documentInfo?.actualDocumentId && documentInfo?.gid ? (
                  // Google Sheets 읽기 전용 미리보기
                  <div className="document-preview-embed">
                    <iframe
                      src={`https://docs.google.com/spreadsheets/d/${documentInfo.actualDocumentId}/edit?usp=sharing&gid=${documentInfo.gid}&rm=minimal&widget=true&chrome=false&headers=false`}
                      className="w-full h-[585px] md:h-[680px] border border-gray-300 rounded"
                      title="문서 미리보기"
                      frameBorder="0"
                      allowFullScreen
                    />
                  </div>
                ) : documentInfo?.previewUrl ? (
                  // API에서 제공한 미리보기 URL 사용
                  <div className="document-preview-embed">
                    <iframe
                      src={documentInfo.previewUrl}
                      className="w-full h-[585px] md:h-[680px] border border-gray-300 rounded"
                      title="문서 미리보기"
                      frameBorder="0"
                      allowFullScreen
                    />
                  </div>
                ) : sheetData.length > 0 ? (
                  // HTML 테이블 백업
                  <div className="document-preview">
                    <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
                      <p className="text-sm text-yellow-800">
                        ⚠️ 스프레드시트를 직접 불러올 수 없어 데이터만 표시합니다.
                      </p>
                    </div>
                    <table className="w-full border-collapse border border-gray-300">
                      <tbody>
                        {sheetData.map((row, rowIndex) => (
                          <tr
                            key={rowIndex}
                            className={rowIndex === 0 ? 'bg-gray-50 font-medium' : ''}
                          >
                            {Array.from({ length: 11 }).map((_, colIndex) => (
                              <td
                                key={colIndex}
                                className="border border-gray-300 p-2 text-sm"
                                style={{
                                  width: `${100 / 11}%`,
                                  backgroundColor: row[colIndex] ? 'white' : '#f9f9f9',
                                }}
                              >
                                {row[colIndex] || ''}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <div className="text-gray-400 text-6xl mb-4">📄</div>
                    <p className="text-gray-500">문서 데이터가 없습니다.</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 데스크톱 사이드바 서명 버튼 */}
          <div className="hidden lg:block lg:col-span-1">
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 sticky top-4">
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
          </div>
        </div>
      </div>

      </div>
    </>
  );
}
