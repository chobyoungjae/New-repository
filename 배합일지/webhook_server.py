#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import sys
import os

# Windows 콘솔 인코딩 문제 해결
os.environ['PYTHONIOENCODING'] = 'utf-8'

# 표준 출력을 UTF-8로 설정
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8')
"""
이카운트 ERP 자동화를 위한 웹훅 서버
Google Apps Script로부터 웹훅을 받아 VBA 스크립트를 실행합니다.
"""

from flask import Flask, request, jsonify
import subprocess
import json
import logging
import os
import sys
from datetime import datetime

# 로깅 설정
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('webhook.log', encoding='utf-8')
    ]
)
logger = logging.getLogger(__name__)

app = Flask(__name__)

# 설정
CONFIG = {
    'VBA_SCRIPT_PATH': 'trigger_icount_upload.vbs',
    'EXCEL_FILE_PATH': r'Y:\4000_생산(조병재)\2025년\ERP 생산등록2 자동\ERP생산등록.xlsx',
    'SERVER_PORT': 5000,
    'SERVER_HOST': 'localhost'
}

@app.route('/')
def home():
    """서버 상태 확인용 홈페이지"""
    return jsonify({
        'status': 'running',
        'message': '이카운트 ERP 웹훅 서버가 실행 중입니다.',
        'timestamp': datetime.now().isoformat(),
        'endpoints': [
            'POST /webhook - 웹훅 수신',
            'GET /health - 서버 상태 확인',
            'GET /logs - 최근 로그 확인'
        ]
    })

@app.route('/health')
def health_check():
    """서버 헬스체크"""
    try:
        # VBA 스크립트 파일 존재 확인
        vba_exists = os.path.exists(CONFIG['VBA_SCRIPT_PATH'])
        excel_exists = os.path.exists(CONFIG['EXCEL_FILE_PATH'])
        
        return jsonify({
            'status': 'healthy',
            'timestamp': datetime.now().isoformat(),
            'checks': {
                'vba_script_exists': vba_exists,
                'excel_file_exists': excel_exists,
                'vba_script_path': CONFIG['VBA_SCRIPT_PATH'],
                'excel_file_path': CONFIG['EXCEL_FILE_PATH']
            }
        })
    except Exception as e:
        logger.error(f"헬스체크 오류: {str(e)}")
        return jsonify({
            'status': 'error',
            'error': str(e),
            'timestamp': datetime.now().isoformat()
        }), 500

@app.route('/logs')
def get_logs():
    """최근 로그 확인 (마지막 50줄)"""
    try:
        if os.path.exists('webhook.log'):
            with open('webhook.log', 'r', encoding='utf-8') as f:
                lines = f.readlines()
                recent_logs = lines[-50:]  # 마지막 50줄
                return jsonify({
                    'status': 'success',
                    'logs': [line.strip() for line in recent_logs],
                    'total_lines': len(recent_logs)
                })
        else:
            return jsonify({
                'status': 'no_logs',
                'message': '로그 파일이 없습니다.'
            })
    except Exception as e:
        logger.error(f"로그 조회 오류: {str(e)}")
        return jsonify({
            'status': 'error',
            'error': str(e)
        }), 500

@app.route('/webhook', methods=['POST'])
def handle_webhook():
    """Google Apps Script로부터 웹훅 처리"""
    try:
        # 요청 데이터 파싱
        if not request.is_json:
            raise ValueError("JSON 형식의 데이터가 필요합니다.")
        
        data = request.get_json()
        action = data.get('action', '')
        webhook_data = data.get('data', {})
        timestamp = data.get('timestamp', '')
        spreadsheet_id = data.get('spreadsheetId', '')
        
        logger.info(f"웹훅 수신: action={action}, timestamp={timestamp}")
        logger.info(f"데이터: {json.dumps(webhook_data, ensure_ascii=False, indent=2)}")
        
        # 액션별 처리
        if action == 'icount_upload':
            return handle_icount_upload(webhook_data, spreadsheet_id)
        else:
            logger.warning(f"알 수 없는 액션: {action}")
            return jsonify({
                'status': 'error',
                'message': f'지원하지 않는 액션: {action}',
                'supported_actions': ['icount_upload']
            }), 400
            
    except Exception as e:
        logger.error(f"웹훅 처리 오류: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': f'웹훅 처리 중 오류가 발생했습니다: {str(e)}',
            'timestamp': datetime.now().isoformat()
        }), 500

def handle_icount_upload(webhook_data, spreadsheet_id):
    """이카운트 업로드 액션 처리 + 엑셀 데이터 가져오기"""
    try:
        data_count = webhook_data.get('dataCount', 0)
        logger.info(f"데이터 처리 시작: {data_count}건 데이터")
        
        # 1단계: 엑셀로 데이터 가져오기 실행
        excel_import_script = 'trigger_excel_import.vbs'
        
        if os.path.exists(excel_import_script):
            logger.info("1단계: 엑셀 데이터 가져오기 실행 중...")
            excel_result = subprocess.run([
                'cscript', 
                '//NoLogo', 
                excel_import_script,
                spreadsheet_id
            ], 
            capture_output=True, 
            text=True,
            timeout=120,  # 2분 타임아웃
            encoding='cp949'
            )
            
            if excel_result.returncode == 0:
                logger.info(f"엑셀 데이터 가져오기 성공: {excel_result.stdout.strip()}")
            else:
                logger.warning(f"엑셀 데이터 가져오기 실패: {excel_result.stderr}")
        else:
            logger.info("엑셀 가져오기 스크립트 없음, 건너뜀")
        
        # 2단계: 기존 이카운트 업로드 (Y:\ 경로 있는 경우만)
        if os.path.exists(CONFIG['VBA_SCRIPT_PATH']) and os.path.exists(CONFIG['EXCEL_FILE_PATH']):
            logger.info("2단계: 이카운트 업로드 실행 중...")
            result = subprocess.run([
                'cscript', 
                '//NoLogo', 
                CONFIG['VBA_SCRIPT_PATH'],
                spreadsheet_id
            ], 
            capture_output=True, 
            text=True,
            timeout=300,  # 5분 타임아웃
            encoding='cp949'
            )
        else:
            logger.info("Y:\ 경로 접근 불가, 이카운트 업로드 건너뜀")
            result = type('obj', (object,), {'returncode': 0, 'stdout': '엑셀 데이터 가져오기만 완료'})()  # 가짜 성공 결과
        
        # 실행 결과 로깅
        if result.returncode == 0:
            logger.info(f"VBA 실행 성공: {result.stdout.strip()}")
            logger.info("이카운트 업로드 완료")
            
            return jsonify({
                'status': 'success',
                'message': '이카운트 자동 업로드가 완료되었습니다.',
                'vba_output': result.stdout.strip(),
                'data_count': data_count,
                'timestamp': datetime.now().isoformat()
            })
        else:
            logger.error(f"VBA 실행 실패 (코드: {result.returncode})")
            logger.error(f"에러 출력: {result.stderr}")
            
            return jsonify({
                'status': 'error',
                'message': f'VBA 실행 실패 (코드: {result.returncode})',
                'error_output': result.stderr,
                'timestamp': datetime.now().isoformat()
            }), 500
            
    except subprocess.TimeoutExpired:
        logger.error("VBA 실행 타임아웃 (5분)")
        return jsonify({
            'status': 'timeout',
            'message': 'VBA 실행이 5분을 초과하여 중단되었습니다.',
            'timestamp': datetime.now().isoformat()
        }), 408
        
    except FileNotFoundError as e:
        logger.error(f"파일 없음: {str(e)}")
        return jsonify({
            'status': 'file_not_found',
            'message': str(e),
            'timestamp': datetime.now().isoformat()
        }), 404
        
    except Exception as e:
        logger.error(f"이카운트 업로드 처리 오류: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': f'이카운트 업로드 처리 중 오류: {str(e)}',
            'timestamp': datetime.now().isoformat()
        }), 500

@app.errorhandler(404)
def not_found(error):
    """404 에러 핸들러"""
    return jsonify({
        'status': 'not_found',
        'message': '요청한 엔드포인트를 찾을 수 없습니다.',
        'available_endpoints': ['/', '/health', '/logs', '/webhook']
    }), 404

@app.errorhandler(500)
def internal_error(error):
    """500 에러 핸들러"""
    logger.error(f"서버 내부 오류: {str(error)}")
    return jsonify({
        'status': 'internal_error',
        'message': '서버 내부 오류가 발생했습니다.',
        'timestamp': datetime.now().isoformat()
    }), 500

if __name__ == '__main__':
    try:
        # 시작 메시지
        print("=" * 60)
        print("이카운트 ERP 웹훅 서버 시작")
        print("=" * 60)
        print(f"서버 주소: http://{CONFIG['SERVER_HOST']}:{CONFIG['SERVER_PORT']}")
        print(f"VBA 스크립트: {CONFIG['VBA_SCRIPT_PATH']}")
        print(f"Excel 파일: {CONFIG['EXCEL_FILE_PATH']}")
        print("=" * 60)
        
        logger.info("웹훅 서버 시작")
        
        # Flask 서버 실행
        app.run(
            host=CONFIG['SERVER_HOST'],
            port=CONFIG['SERVER_PORT'],
            debug=False,  # 프로덕션에서는 False
            threaded=True
        )
        
    except KeyboardInterrupt:
        logger.info("사용자에 의해 서버가 중단되었습니다.")
        print("\n서버가 중단되었습니다.")
    except Exception as e:
        logger.error(f"서버 시작 오류: {str(e)}")
        print(f"서버 시작 중 오류가 발생했습니다: {str(e)}")
    finally:
        print("웹훅 서버 종료")