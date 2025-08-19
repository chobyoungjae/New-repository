#!/usr/bin/env python3
"""
Google Sheets 연결 테스트 스크립트
중량선별기 시스템용 기본 테스트
"""

import gspread
from google.oauth2.service_account import Credentials
import json
import os
from datetime import datetime

def load_config():
    """설정 파일 로드"""
    config_path = os.path.join(os.path.dirname(__file__), 'config', 'settings.json')
    with open(config_path, 'r', encoding='utf-8') as f:
        return json.load(f)

def test_google_sheets_connection():
    """Google Sheets 연결 테스트"""
    try:
        print("🔧 Google Sheets 연결 테스트 시작...")
        
        # 설정 로드
        config = load_config()
        
        # 인증 정보 설정
        scope = [
            'https://spreadsheets.google.com/feeds',
            'https://www.googleapis.com/auth/drive'
        ]
        
        credentials_path = config['google_sheets']['credentials_file']
        print(f"📁 인증 파일: {credentials_path}")
        
        # 인증
        credentials = Credentials.from_service_account_file(credentials_path, scopes=scope)
        client = gspread.authorize(credentials)
        
        # 스프레드시트 열기
        spreadsheet_id = config['google_sheets']['spreadsheet_id']
        print(f"📊 스프레드시트 ID: {spreadsheet_id}")
        
        spreadsheet = client.open_by_key(spreadsheet_id)
        worksheet = spreadsheet.worksheet(config['google_sheets']['sheet_name'])
        
        print(f"✅ 워크시트 '{config['google_sheets']['sheet_name']}' 연결 성공")
        
        # 테스트 데이터 준비
        test_data = [
            datetime.now().strftime('%Y-%m-%d %H:%M:%S'),  # TIMESTAMP
            datetime.now().strftime('%Y-%m-%d'),           # DATE  
            datetime.now().strftime('%H:%M:%S'),           # TIME
            1,                                             # P_No
            'TEST_LOT_001',                               # LOT
            1,                                            # COUNT
            'TEST',                                       # GRADE
            50.5                                          # WEIGHT
        ]
        
        # 데이터 업로드 테스트
        print("📤 테스트 데이터 업로드 중...")
        worksheet.append_row(test_data)
        
        print("✅ 테스트 데이터 업로드 성공!")
        print(f"📋 업로드된 데이터: {test_data}")
        
        # 최근 데이터 확인
        print("\n📖 최근 3행 데이터 확인:")
        recent_data = worksheet.get_all_values()[-3:]  # 마지막 3행
        for i, row in enumerate(recent_data, 1):
            print(f"  Row {i}: {row}")
        
        return True
        
    except FileNotFoundError as e:
        print(f"❌ 파일을 찾을 수 없음: {e}")
        return False
    except gspread.exceptions.WorksheetNotFound as e:
        print(f"❌ 워크시트를 찾을 수 없음: {e}")
        print("💡 스프레드시트에서 '1라인' 시트가 있는지 확인하세요")
        return False
    except Exception as e:
        print(f"❌ 연결 테스트 실패: {e}")
        return False

def main():
    """메인 함수"""
    print("=" * 60)
    print("🏭 중량선별기 Google Sheets 연결 테스트")
    print("=" * 60)
    
    # Google Sheets 테스트
    if test_google_sheets_connection():
        print("\n🎉 모든 테스트 통과!")
        print("📌 다음 단계: 중량선별기 하드웨어 연결 및 시리얼 통신 테스트")
    else:
        print("\n❌ 테스트 실패")
        print("🔧 문제 해결 가이드:")
        print("  1. credentials.json 파일이 올바른 위치에 있는지 확인")
        print("  2. 서비스 계정에 스프레드시트 편집 권한이 있는지 확인")  
        print("  3. 스프레드시트에 '1라인' 시트가 존재하는지 확인")
        print("  4. 인터넷 연결 상태 확인")
    
    print("\n🔚 테스트 완료")

if __name__ == "__main__":
    main()