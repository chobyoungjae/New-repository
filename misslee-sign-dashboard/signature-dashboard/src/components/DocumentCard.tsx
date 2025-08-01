"use client";

import React from "react";
import { Document, SignatureStatus } from "@/types";

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
  const getSignatureStatus = (): SignatureStatus => {
    return {
      teamLeader: !!document.teamLeaderSignature,
      review: !!document.reviewSignature,
      ceo: !!document.ceoSignature,
    };
  };

  const signatureStatus = getSignatureStatus();

  const handleSignClick = () => {
    if (isSigningInProgress) return; // 서명 중일 때 클릭 방지
    
    if (window.confirm("서명을 완료하시겠습니까?")) {
      onSignature(document.id);
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow duration-200 p-4 mb-4">
      {/* 문서 헤더 */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center space-x-2">
          <span className="text-2xl">📅</span>
          <span className="text-sm text-gray-600">{document.date}</span>
        </div>
        {!document.isCompleted && (
          <span className="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded-full">
            서명 대기
          </span>
        )}
      </div>

      {/* 문서 제목 */}
      <div className="flex items-center space-x-2 mb-2">
        <span className="text-xl">📄</span>
        <h3 className="font-semibold text-gray-900 text-lg">
          {document.title}
        </h3>
      </div>

      {/* 작성자 */}
      <div className="flex items-center space-x-2 mb-3">
        <span className="text-lg">👤</span>
        <span className="text-gray-700">작성자: {document.author}</span>
      </div>

      {/* 문서 내용 */}
      <div className="flex items-start space-x-2 mb-4">
        <span className="text-lg mt-0.5">📝</span>
        <p className="text-gray-600 text-sm leading-relaxed">
          {document.content}
        </p>
      </div>

      {/* 서명 현황 */}
      <div className="border-t pt-3 mb-4">
        <h4 className="text-sm font-medium text-gray-700 mb-2">서명 현황:</h4>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-1">
            <span className="text-sm text-gray-600">팀장:</span>
            <span
              className={`text-lg ${
                signatureStatus.teamLeader ? "text-green-500" : "text-gray-300"
              }`}
            >
              {signatureStatus.teamLeader ? "✅" : "⏳"}
            </span>
          </div>
          <div className="flex items-center space-x-1">
            <span className="text-sm text-gray-600">검토:</span>
            <span
              className={`text-lg ${
                signatureStatus.review ? "text-green-500" : "text-gray-300"
              }`}
            >
              {signatureStatus.review ? "✅" : "⏳"}
            </span>
          </div>
          <div className="flex items-center space-x-1">
            <span className="text-sm text-gray-600">대표:</span>
            <span
              className={`text-lg ${
                signatureStatus.ceo ? "text-green-500" : "text-gray-300"
              }`}
            >
              {signatureStatus.ceo ? "✅" : "⏳"}
            </span>
          </div>
        </div>
      </div>

      {/* 액션 버튼들 */}
      <div className="flex space-x-2">
        <a
          href={`/document/${document.id}`}
          className="flex-1 bg-blue-50 text-blue-700 text-center py-2 px-4 rounded-md text-sm font-medium hover:bg-blue-100 transition-colors"
        >
          📋 문서 보기
        </a>

        {!document.isCompleted && (
          <button
            onClick={handleSignClick}
            disabled={isSigningInProgress}
            className={`flex-1 text-white text-center py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              isSigningInProgress
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-green-600 hover:bg-green-700'
            }`}
          >
            {isSigningInProgress ? (
              <span className="flex items-center justify-center space-x-2">
                <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
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
