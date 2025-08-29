# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a multi-purpose repository containing Google Apps Script workflows, React Native (Expo) mobile app, and a Next.js dashboard system for document management and business processes.

### Project Structure

- **Google Apps Script Workflows** - Various automation scripts for Google Sheets/Forms integration
- **React Native App** - Expo-based mobile dashboard viewer  
- **Next.js Dashboard** - Full-featured signature dashboard system (in `misslee-sign-dashboard/signature-dashboard/`)

## Essential Commands

### React Native (Root Directory)
```bash
npm start        # Start Expo development server
npm run android  # Run on Android
npm run ios      # Run on iOS
npm run web      # Run on web browser
```

### Next.js Dashboard (misslee-sign-dashboard/signature-dashboard/)
```bash
cd misslee-sign-dashboard/signature-dashboard
npm run dev --turbopack  # Start development server with Turbopack
npm run build            # Build for production
npm run start            # Start production server
npm run lint             # Run ESLint
```

## Architecture Overview

### 1. Google Apps Script Systems

The repository contains multiple standalone Google Apps Script projects for various business workflows:

- **전자서명 시스템** - Electronic signature workflow with multi-step approval (팀장 → 검토자 → 대표)
- **품질점검 대시보드** - Quality check dashboards for various departments
- **배합일지** - Production batch records with view management
- **원재료 발주** - Material ordering system with calendar integration
- **카카오톡 연동** - KakaoTalk integration for notifications
- **ERP 재고 연동** - ERP inventory API integration

Each script follows a pattern:
- `Code.js` - Main business logic
- `appsscript.json` - Google Apps Script manifest
- `최신배포 웹앱 URL.js` - Web app deployment URL

### 2. React Native Dashboard Viewer

Located in root directory (`App.js`):
- Fetches board list from Google Apps Script API
- Displays documents from selected boards
- Simple viewer interface for mobile access

### 3. Next.js Signature Dashboard

Located in `misslee-sign-dashboard/signature-dashboard/`:
- Full authentication system with JWT tokens
- Google Sheets as database backend
- Multi-step signature workflow
- PDF generation and storage
- PWA support for offline access

## Google Apps Script Integration Pattern

### Standard Configuration Pattern
```javascript
const CFG = {
  DATA: 'A시트',        // Main data sheet
  TEMPLATE: '문서',      // Document template
  LOOKUP: 'B시트',       // Name-ID mapping sheet
  MAP_ID: '문서ID',      // Document-Script mapping
  COL: {                 // Column index mapping
    KEY: 5,
    LEADER: 12,
    // ...
  }
}
```

### Signature Workflow
1. Form submission triggers `onFormSubmit(e)`
2. Creates personal sheet from template
3. Routes to appropriate board based on role
4. Each approval calls `doGet(e)` with role parameter
5. Final approval triggers PDF generation and calendar update

### Common Patterns
- **Sheet Name Generation**: `B열_F열_C열_날짜범위(J열)` format
- **Unique Identifiers**: Stored in column U (21)
- **PDF Generation**: Uses UrlFetchApp with OAuth tokens
- **Calendar Integration**: Creates events with team-based colors

## Environment Configuration

### Google Apps Script Requirements
- Service Account permissions for target spreadsheets
- Calendar API access for event creation
- Drive API access for PDF storage

### Next.js Dashboard Environment Variables
```
GOOGLE_SERVICE_ACCOUNT_EMAIL=
GOOGLE_PRIVATE_KEY=
MAIN_SPREADSHEET_ID=
JWT_SECRET=
```

## Development Notes

### Google Apps Script Best Practices
- Always use `SpreadsheetApp.flush()` after formula updates
- Lock service for concurrent operations
- Store unique names in column U for reference
- Use IMPORTRANGE for cross-spreadsheet data

### Common Gotchas
- Google Sheets IDs can contain underscores - use `lastIndexOf('_')` for parsing
- Next.js 15 params are Promises - await before use
- PDF viewer requires dynamic import with SSR disabled
- Service Account needs explicit sharing permissions

### Korean Naming Conventions
The codebase uses Korean terminology throughout:
- 팀장 (Team Leader)
- 검토자 (Reviewer)  
- 대표 (CEO)
- 서명 (Signature)
- 문서 (Document)
- 시트 (Sheet)

## Testing

No automated tests configured. Manual testing involves:
1. For Google Apps Script: Deploy as web app and test endpoints
2. For React Native: Use Expo Go app or simulators
3. For Next.js: Run development server and test workflows