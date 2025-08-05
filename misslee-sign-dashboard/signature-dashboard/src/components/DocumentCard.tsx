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
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow duration-200 p-3 sm:p-4 mb-3 sm:mb-4">
      {/* 문서 헤더 */}
      <div className="flex items-start justify-between mb-2 sm:mb-3">
        <div className="flex items-center space-x-1.5 sm:space-x-2">
          <span className="text-lg sm:text-2xl">📅</span>
          <span className="text-xs sm:text-sm text-gray-600">{document.date}</span>
        </div>
        <div className="border border-gray-200 rounded overflow-hidden bg-white shadow-sm">
          <table className="text-xs">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-2 py-1 font-medium text-gray-700 border-r border-gray-200">팀장</th>
                <th className="px-2 py-1 font-medium text-gray-700 border-r border-gray-200">검토</th>
                <th className="px-2 py-1 font-medium text-gray-700">대표</th>
              </tr>
            </thead>
            <tbody>
              <tr className="bg-white">
                <td className="px-1 py-1.5 text-center border-r border-gray-200">
                  <div className="flex flex-col items-center space-y-0.5">
                    <span
                      className={`text-sm ${
                        signatureStatus.teamLeader ? "text-green-500" : "text-gray-300"
                      }`}
                    >
                      {signatureStatus.teamLeader ? "✅" : "⏳"}
                    </span>
                    {document.teamLeaderSignature && (
                      <span className="text-xs text-gray-600 leading-tight">
                        {document.teamLeaderSignature}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-1 py-1.5 text-center border-r border-gray-200">
                  <div className="flex flex-col items-center space-y-0.5">
                    <span
                      className={`text-sm ${
                        signatureStatus.review ? "text-green-500" : "text-gray-300"
                      }`}
                    >
                      {signatureStatus.review ? "✅" : "⏳"}
                    </span>
                    {document.reviewSignature && (
                      <span className="text-xs text-gray-600 leading-tight">
                        {document.reviewSignature}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-1 py-1.5 text-center">
                  <div className="flex flex-col items-center space-y-0.5">
                    <span
                      className={`text-sm ${
                        signatureStatus.ceo ? "text-green-500" : "text-gray-300"
                      }`}
                    >
                      {signatureStatus.ceo ? "✅" : "⏳"}
                    </span>
                    {document.ceoSignature && (
                      <span className="text-xs text-gray-600 leading-tight">
                        {document.ceoSignature}
                      </span>
                    )}
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* 문서 제목 */}
      <div className="flex items-center space-x-1.5 sm:space-x-2 mb-1.5 sm:mb-2">
        <span className="text-lg sm:text-xl">📄</span>
        <h3 className="font-semibold text-gray-900 text-base sm:text-lg">
          {document.title}
        </h3>
      </div>

      {/* 작성자 */}
      <div className="flex items-center space-x-1.5 sm:space-x-2 mb-2 sm:mb-3">
        <span className="text-base sm:text-lg">👤</span>
        <span className="text-gray-700 text-sm sm:text-base">작성자: {document.author}</span>
      </div>

      {/* 문서 내용 */}
      <div className="flex items-start space-x-1.5 sm:space-x-2 mb-3 sm:mb-4">
        <span className="text-base sm:text-lg mt-0.5">📝</span>
        <p className="text-gray-600 text-xs sm:text-sm leading-relaxed">
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
