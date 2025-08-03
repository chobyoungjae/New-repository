'use client';

import React, { useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';

// PDF.js worker 설정
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PDFViewerProps {
  fileId: string;
  title?: string;
}

const PDFViewer: React.FC<PDFViewerProps> = ({ fileId, title = 'PDF 문서' }) => {
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [scale, setScale] = useState<number>(1.0);

  // Google Drive PDF 미리보기 URL (여러 방법 시도)
  const pdfUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
  const viewUrl = `https://drive.google.com/file/d/${fileId}/view`;
  const embedUrl = `https://drive.google.com/file/d/${fileId}/preview`;
  
  // 프록시를 통한 PDF 로드 시도
  const proxyUrl = `/api/pdf-proxy?fileId=${fileId}`;

  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages);
    setLoading(false);
    setError('');
  }

  function onDocumentLoadError(error: Error) {
    console.error('PDF 로드 오류:', error);
    setError('PDF 파일을 불러올 수 없습니다.');
    setLoading(false);
  }

  const goToPrevPage = () => {
    setPageNumber(prev => Math.max(prev - 1, 1));
  };

  const goToNextPage = () => {
    setPageNumber(prev => Math.min(prev + 1, numPages));
  };

  const zoomIn = () => {
    setScale(prev => Math.min(prev + 0.2, 2.0));
  };

  const zoomOut = () => {
    setScale(prev => Math.max(prev - 0.2, 0.5));
  };

  if (error) {
    return (
      <div className="space-y-4">
        {/* Google Drive iframe 임베드 시도 */}
        <div className="bg-white border rounded">
          <div className="bg-gray-100 p-3 border-b">
            <h3 className="font-medium text-gray-700">📄 PDF 미리보기 (Google Drive)</h3>
          </div>
          <div className="p-4">
            <iframe
              src={embedUrl}
              className="w-full h-[600px] border border-gray-300 rounded"
              title="PDF 문서 미리보기 (Google Drive)"
              frameBorder="0"
              allowFullScreen
            />
          </div>
        </div>
        
        {/* 대체 방법 */}
        <div className="bg-gray-50 p-6 text-center rounded border-2 border-dashed border-gray-300">
          <div className="text-4xl mb-4">📄</div>
          <h3 className="text-lg font-semibold text-gray-700 mb-4">추가 옵션</h3>
          <p className="text-gray-600 mb-6">
            위에서 PDF가 보이지 않으면 아래 버튼을 사용하세요.
          </p>
          <div className="space-x-4">
            <a
              href={viewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
            >
              📄 새 탭에서 보기
            </a>
            <a
              href={pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors"
            >
              💾 PDF 다운로드
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pdf-viewer">
      {/* PDF 컨트롤 바 */}
      <div className="bg-gray-100 p-4 rounded-t border flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center space-x-2">
          <span className="text-sm font-medium text-gray-700">{title}</span>
        </div>
        
        <div className="flex items-center space-x-4">
          {/* 페이지 네비게이션 */}
          {numPages > 0 && (
            <div className="flex items-center space-x-2">
              <button
                onClick={goToPrevPage}
                disabled={pageNumber <= 1}
                className="px-3 py-1 bg-white border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                ◀
              </button>
              <span className="text-sm text-gray-600 min-w-max">
                {pageNumber} / {numPages}
              </span>
              <button
                onClick={goToNextPage}
                disabled={pageNumber >= numPages}
                className="px-3 py-1 bg-white border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                ▶
              </button>
            </div>
          )}

          {/* 줌 컨트롤 */}
          <div className="flex items-center space-x-2">
            <button
              onClick={zoomOut}
              className="px-3 py-1 bg-white border rounded hover:bg-gray-50"
            >
              🔍-
            </button>
            <span className="text-sm text-gray-600 min-w-max">
              {Math.round(scale * 100)}%
            </span>
            <button
              onClick={zoomIn}
              className="px-3 py-1 bg-white border rounded hover:bg-gray-50"
            >
              🔍+
            </button>
          </div>

          {/* 외부 링크 */}
          <div className="flex items-center space-x-2">
            <a
              href={viewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-700 text-sm"
            >
              🔗 새 탭에서 열기
            </a>
          </div>
        </div>
      </div>

      {/* PDF 문서 영역 */}
      <div className="border border-t-0 rounded-b bg-white overflow-auto" style={{ height: '700px' }}>
        {loading && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">PDF 로딩 중...</p>
            </div>
          </div>
        )}

        <div className="flex justify-center p-4">
          <Document
            file={proxyUrl} // 프록시 URL 먼저 시도
            onLoadSuccess={onDocumentLoadSuccess}
            onLoadError={(error) => {
              console.log('프록시 로드 실패, iframe 방식으로 대체');
              setError('프록시 로드 실패');
            }}
            loading=""
            options={{
              cMapUrl: `//unpkg.com/pdfjs-dist@${pdfjs.version}/cmaps/`,
              cMapPacked: true,
              standardFontDataUrl: `//unpkg.com/pdfjs-dist@${pdfjs.version}/standard_fonts/`,
            }}
          >
            <Page
              pageNumber={pageNumber}
              scale={scale}
              renderTextLayer={false}
              renderAnnotationLayer={false}
              className="shadow-lg"
            />
          </Document>
        </div>
      </div>
    </div>
  );
};

export default PDFViewer;