"use client";

import React from "react";
import { Document } from "@/types";

interface DocumentCardProps {
  document: Document;
  onSignature: (documentId: string) => void;
  isSigningInProgress?: boolean;
}

export const DocumentCard: React.FC<DocumentCardProps> = ({
  document,
  onSignature,
  isSigningInProgress = false,
}) => {

  const handleSignClick = () => {
    if (isSigningInProgress) return; // 서명 중일 때 클릭 방지
    
    if (window.confirm("서명을 완료하시겠습니까?")) {
      onSignature(document.id);
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow duration-200 p-3 sm:p-4 mb-3 sm:mb-4">
      {/* 문서 헤더 */}
      <div className="mb-2 sm:mb-3">
        {/* 날짜 */}
        <div className="flex items-center space-x-1.5 sm:space-x-2 mb-1 sm:mb-1.5">
          <span className="text-base sm:text-lg">📅</span>
          <span className="text-sm sm:text-base text-gray-600 font-semibold">{document.date}</span>
        </div>
        
        {/* 작성자 */}
        <div className="flex items-center space-x-1.5 sm:space-x-2">
          <span className="text-base sm:text-lg">👤</span>
          <span className="text-gray-700 text-sm sm:text-base font-semibold">작성자: {document.author}</span>
        </div>
      </div>

      {/* 문서 제목 */}
      <div className="flex items-center space-x-1.5 sm:space-x-2 mb-1.5 sm:mb-2">
        <span className="text-lg sm:text-xl">📄</span>
        <h3 className="font-semibold text-gray-900 leading-tight flex-1 min-w-0">
          <span 
            className={`block ${
              document.title.length > 30 
                ? 'text-sm sm:text-base' 
                : 'text-base sm:text-lg'
            } truncate`}
          >
            {document.title}
          </span>
        </h3>
      </div>

      {/* 문서 내용 */}
      <div className="flex items-start space-x-1.5 sm:space-x-2 mb-3 sm:mb-4">
        <span className="text-base sm:text-lg mt-0.5">📝</span>
        <p className="text-gray-700 text-sm sm:text-base leading-tight font-semibold truncate">
          {document.content}
        </p>
      </div>

      {/* 액션 버튼들 */}
      <div className="flex space-x-2">
        <a
          href={`/document/${document.id}`}
          className="flex-1 bg-blue-50 text-blue-700 text-center py-1.5 sm:py-2 px-3 sm:px-4 rounded-md text-xs sm:text-sm font-medium hover:bg-blue-100 transition-colors"
        >
          📋 문서 보기
        </a>

        {!document.isCompleted && (
          <button
            onClick={handleSignClick}
            disabled={isSigningInProgress}
            className={`flex-1 text-white text-center py-1.5 sm:py-2 px-3 sm:px-4 rounded-md text-xs sm:text-sm font-medium transition-colors ${
              isSigningInProgress
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-green-600 hover:bg-green-700'
            }`}
          >
            {isSigningInProgress ? (
              <span className="flex items-center justify-center space-x-1.5 sm:space-x-2">
                <span className="animate-spin rounded-full h-3 sm:h-4 w-3 sm:w-4 border-b-2 border-white"></span>
                <span>서명 중...</span>
              </span>
            ) : (
              '✍️ 서명하기'
            )}
          </button>
        )}
      </div>
    </div>
  );
};
