# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Korean signature dashboard application called "미쓰리 서명 대시보드" (Miss Lee Signature Dashboard) built with Next.js 15. The application manages document signing workflows using Google Sheets as the backend data store.

## Essential Commands

### Development
```bash
cd signature-dashboard
npm run dev --turbopack  # Start development server with Turbopack
npm run build           # Build for production
npm run start          # Start production server
npm run lint           # Run ESLint
```

The development server runs on http://localhost:3000 by default.

## Architecture Overview

### Core Architecture
- **Frontend**: Next.js 15 with App Router
- **Authentication**: JWT tokens with bcryptjs for password hashing
- **Data Storage**: Google Sheets API integration
- **Styling**: Tailwind CSS 4.0
- **State Management**: React Context (AuthContext)
- **PWA Support**: Manifest and service worker configured

### Key Data Flow
1. **User Management**: Users are stored in a main Google Spreadsheet with a "회원정보" (Member Info) sheet
2. **Document Workflow**: Each user has a personal spreadsheet for their documents with signatures tracking
3. **Signature Process**: Documents track team leader, review, and CEO signatures in separate columns
4. **Google Apps Script Integration**: Webhook-based triggers for automation when signatures are completed

### Directory Structure
- `src/app/` - Next.js App Router pages and API routes
- `src/components/` - Reusable React components
- `src/contexts/` - React Context providers (AuthContext)
- `src/lib/` - Core business logic (GoogleSheetsService)
- `src/types/` - TypeScript type definitions
- `src/utils/` - Utility functions

### Critical Files
- `src/lib/googleSheets.ts` - Main Google Sheets integration service
- `src/contexts/AuthContext.tsx` - Authentication state management
- `SETUP_SHEETS.md` - Google Sheets configuration guide

## Google Sheets Integration

### Main Spreadsheet Structure
- **회원정보 sheet**: User account data (employee ID, name, personal sheet ID, username, email, join date, hashed password)
- **문서ID sheet**: Maps users to their personal spreadsheets and webhook URLs

### Personal Spreadsheet Structure (PRD format)
Each user has a personal spreadsheet with columns A-O:
- A: 날짜 (Date)
- B: 문서명 (Document Title) 
- C: 작성자 (Author)
- D: 내용 (Content)
- H: 팀장서명 (Team Leader Signature)
- I: 검토서명 (Review Signature)
- J: 대표서명 (CEO Signature)
- L: 완료체크 (Completion Check)
- O: 문서링크 (Document Link)

### Environment Variables Required
```
GOOGLE_SERVICE_ACCOUNT_EMAIL=
GOOGLE_PRIVATE_KEY=
MAIN_SPREADSHEET_ID=
JWT_SECRET=
```

## Authentication Flow

1. User registration creates entry in main spreadsheet "회원정보" sheet
2. Login validates against stored bcrypt hashed passwords
3. JWT tokens stored in HTTP-only cookies
4. AuthContext manages client-side authentication state
5. API routes use JWT verification middleware

## Document Signing Workflow

1. Documents appear in user's personal spreadsheet
2. Dashboard shows unsigned documents (where L column ≠ TRUE)
3. Signature completion updates L column to TRUE
4. Webhook triggers Google Apps Script for further automation
5. System tracks team leader, review, and CEO signature status

## Development Notes

- The app is designed as a PWA with offline capabilities
- Korean language interface throughout
- Uses Google Sheets as database with complex webhook integration
- Authentication is cookie-based with JWT tokens
- All Google Sheets operations go through GoogleSheetsService class
- Error handling includes comprehensive logging for debugging

## 한국어 코딩 규칙 및 가이드라인

### 필수사항
- **함수명/변수명**: 직관적이고 명확하게 작성 (getUserSheetId, generateEmployeeNumber)
- **한글 주석 필수**: 코드 맥락, 이유, 목적을 한글로 설명
- **최신 문법 사용**: const/let, 템플릿 리터럴, 화살표 함수, async/await 활용
- **예외처리 필수**: try-catch, 입력값 검증, API 호출 에러 처리 포함
- **상수 분리**: 하드코딩 금지, 환경변수 및 설정 객체 활용
- **단일 책임**: 함수는 하나의 역할만 수행
- **TypeScript**: 타입 정의 필수, 인터페이스 적극 활용

### 금지사항
- var 사용, 축약어, 불명확한 이름
- 하드코딩된 문자열/숫자/URL
- 예외처리 없는 외부 호출
- 주석 없는 복잡한 로직
- any 타입 사용

### 응답방식
- 한글로 자세한 설명 제공
- 예제 코드 포함
- 단계별 구현 설명
- 성능 및 주의사항 명시
- 모바일 친화적 UI (Tailwind CSS 활용)

### 프로젝트 개발 시 주의사항
- 기술 스택: Next.js 15 + TypeScript + Tailwind CSS 4.0
- 단계별 구현 요청 (한 번에 전체 구현하지 말고)
- 구체적 요구사항 명시
- 한국어로 소통 및 응답

## Testing

No specific test framework is configured. Manual testing involves:
1. Register at `/register`
2. Verify user creation in Google Sheets
3. Login at `/login` 
4. Check dashboard functionality at `/dashboard`
5. Test document signing workflow