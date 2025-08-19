# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 프로젝트 개요

이 프로젝트는 **중량선별기 실시간 데이터 수집 시스템**으로, 인테크 중량선별기의 RS-485 통신을 통해 측정 데이터를 수집하고 Google Sheets에 실시간으로 업로드하는 IoT 시스템입니다.

## 기술 스택

- **하드웨어**: Raspberry Pi 4B (4GB RAM)
- **통신**: RS-485 to TTL 컨버터 (MAX485)
- **언어**: Python 3.9+
- **주요 라이브러리**: pyserial, gspread, google-auth, pandas, psutil

## 개발 환경 및 명령어

### Python 가상환경 활성화
```bash
cd ~/checkweigher
source venv/bin/activate
```

### 필수 라이브러리 설치
```bash
pip install -r requirements.txt
```

### 시리얼 포트 테스트
```bash
# 시리얼 포트 확인
ls -la /dev/serial* /dev/ttyAMA*

# 간단한 시리얼 테스트
python test_serial_simple.py

# 상세 시리얼 진단
python test_serial_debug.py

# Google Sheets 연결 테스트
python test_sheets.py
```

### 시스템 서비스 관리
```bash
# 서비스 상태 확인
sudo systemctl status checkweigher.service

# 서비스 시작/중지
sudo systemctl start checkweigher.service
sudo systemctl stop checkweigher.service

# 로그 확인
journalctl -u checkweigher.service -f
```

## 프로젝트 구조

```
/home/pi/checkweigher/
├── main.py              # 메인 실행 파일
├── config/
│   ├── settings.json    # 시스템 설정 파일
│   └── credentials.json # Google API 인증 정보
├── modules/
│   ├── serial_reader.py # RS-485 시리얼 통신
│   ├── data_parser.py   # 데이터 파싱 및 변환
│   ├── sheets_uploader.py # Google Sheets 업로드
│   └── local_backup.py  # 로컬 SQLite 백업
├── test/               # 테스트 스크립트
├── logs/              # 시스템 로그
└── backup/           # 로컬 데이터 백업
```

## 핵심 설정 파일

### settings.json 구조
- **serial**: RS-485 통신 설정 (포트, 보드레이트, 타임아웃)
- **google_sheets**: 스프레드시트 ID, 시트명, 인증 파일 경로
- **local_backup**: SQLite 백업 설정
- **system**: 로그 레벨, 배치 업로드 간격, 재시도 횟수
- **device**: 장비 정보 (ID, 위치, 제조사, 모델)

## 하드웨어 연결

### RS-485 연결 (중요!)
```
중량선별기 → RS-485 컨버터 → 라즈베리파이
485+ (A) → A (Yellow) → (데이터 라인)
485- (B) → B (Blue)   → (데이터 라인)
GND     → Gnd (Black) → Pin 9 (GND)
        → Vcc (Red)   → Pin 2 (5V)
        → Ro (Green)  → Pin 10 (GPIO15/RXD)
        → Di (White)  → Pin 8 (GPIO14/TXD)
```

### 라즈베리파이 설정
```bash
# UART 활성화 확인
sudo raspi-config
# Interface Options → Serial Port
# Login shell: No, Hardware: Yes

# /boot/config.txt에 추가
enable_uart=1
dtoverlay=disable-bt
```

## 데이터 처리 흐름

1. **데이터 수집**: RS-485로 중량선별기에서 측정 데이터 수신
2. **데이터 파싱**: CSV 형식으로 변환 (DATE,TIME,P_No,LOT,COUNT,GRADE,WEIGHT)
3. **로컬 백업**: SQLite에 즉시 저장 (네트워크 장애 대비)
4. **실시간 업로드**: Google Sheets API로 배치 전송
5. **재시도 로직**: 실패 시 최대 3회 재시도
6. **모니터링**: 시스템 상태 및 성능 감시

## 테스트 및 진단 도구

### test_serial_simple.py
- 여러 포트와 보드레이트로 기본 연결 테스트
- 간단한 데이터 수신 확인

### test_serial_debug.py  
- 상세한 시리얼 포트 진단
- 16진수 바이트 데이터 출력
- ASCII/UTF-8 변환 시도
- 하드웨어 연결 상태 확인

### test_sheets.py
- Google Sheets API 연결 테스트
- 테스트 데이터 업로드
- 인증 정보 검증

## 한국어 코딩 규칙 및 가이드라인

### 필수사항
- **함수명/변수명**: 직관적이고 명확하게 작성 (getUserSheetId, generateEmployeeNumber)
- **한글 주석 필수**: 코드 맥락, 이유, 목적을 한글로 설명
- **최신 문법 사용**: const/let, 템플릿 리터럴, 화살표 함수, async/await 활용
- **예외처리 필수**: try-catch, 입력값 검증, API 호출 에러 처리 포함
- **상수 분리**: 하드코딩 금지, 환경변수 및 설정 객체 활용
- **단일 책임**: 함수는 하나의 역할만 수행

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

### 프로젝트 개발 시 주의사항
- 기술 스택: Python 3.9+ (Raspberry Pi 환경)
- 단계별 구현 요청 (한 번에 전체 구현하지 말고)
- 구체적 요구사항 명시
- 한국어로 소통 및 응답

