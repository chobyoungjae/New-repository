# 중량선별기 실시간 데이터 수집 시스템 완전 설치 가이드

## 📋 목차

1. [프로젝트 개요](#프로젝트-개요)
2. [Phase 1: 하드웨어 준비](#phase-1-하드웨어-준비)
3. [Phase 2: 라즈베리파이 초기 설정](#phase-2-라즈베리파이-초기-설정)
4. [Phase 3: RS-485 하드웨어 연결](#phase-3-rs-485-하드웨어-연결)
5. [Phase 4: 소프트웨어 개발 환경 구축](#phase-4-소프트웨어-개발-환경-구축)
6. [Phase 5: 시스템 테스트](#phase-5-시스템-테스트)
7. [Phase 6: 운영 및 유지보수](#phase-6-운영-및-유지보수)
8. [문제해결 가이드](#문제해결-가이드)

---

## 프로젝트 개요

**중량선별기 실시간 데이터 수집 시스템**은 인테크 중량선별기의 RS-485 통신을 통해 측정 데이터를 수집하고 Google Sheets에 실시간으로 업로드하는 IoT 시스템입니다.

### 시스템 구성

```
[중량선별기] ←RS-485→ [라즈베리파이] ←Wi-Fi→ [Google Sheets]
    ↓                      ↓                     ↓
[기존 USB저장]         [로컬 백업]          [실시간 모니터링]
```

### 기술 스택

- **하드웨어**: Raspberry Pi 4B (4GB RAM)
- **통신**: RS-485 to TTL 컨버터 (MAX485)
- **언어**: Python 3.9+
- **주요 라이브러리**: pyserial, gspread, google-auth, pandas

---

## Phase 1: 하드웨어 준비

### 필수 구매 품목

| 품목                 | 사양           | 수량  | 예상가격 | 용도          |
| -------------------- | -------------- | ----- | -------- | ------------- |
| Raspberry Pi 4B      | 4GB RAM        | 1개   | 80,000원 | 메인 컨트롤러 |
| RS-485 to TTL 컨버터 | MAX485 칩셋    | 1개   | 8,000원  | 시리얼 통신   |
| MicroSD 카드         | Class 10, 64GB | 1개   | 15,000원 | OS 저장       |
| 라즈베리파이 케이스  | 공식 케이스    | 1개   | 12,000원 | 보호 케이스   |
| 전원 어댑터          | 5V 3A USB-C    | 1개   | 15,000원 | 전원 공급     |
| 점퍼 와이어          | 암수 혼합 40개 | 1세트 | 3,000원  | 연결선        |

**총 예상 비용: 133,000원**

### 추천 추가 품목

- 방열판: 5,000원 (온도 관리)
- USB 저장장치: 10,000원 (추가 백업)
- 터미널 블록: 4,000원 (안정적 연결)

---

## Phase 2: 라즈베리파이 초기 설정

### Step 1: Raspberry Pi OS 설치

#### A. SD카드 준비

1. **Raspberry Pi Imager** 다운로드 (https://www.raspberrypi.org/software/)
2. 64GB MicroSD 카드를 컴퓨터에 연결
3. Raspberry Pi Imager 실행

#### B. OS 설치 및 설정

1. **장치 선택**: Raspberry Pi 4
2. **OS 선택**: Raspberry Pi OS (64-bit)
3. **저장소 선택**: SD카드
4. **고급 설정**:
   - 호스트명: `checkweigher`
   - 사용자명: `pi` / 비밀번호: `misslee1!`
   - Wi-Fi 설정: 공장 Wi-Fi 정보 입력
   - SSH 활성화: ✅ 체크
   - 시간대: Asia/Seoul
   - 키보드: kr

### Step 2: 첫 부팅 및 기본 설정

#### A. 하드웨어 연결

1. SD카드를 라즈베리파이에 삽입
2. HDMI, 키보드, 마우스 연결
3. 전원 어댑터 연결하여 부팅

#### B. 시스템 업데이트

```bash
# 터미널 실행 후
sudo apt update
sudo apt upgrade -y

# 시간대 설정
sudo timedatectl set-timezone Asia/Seoul
```

### Step 3: 시리얼 통신 활성화 (중요!)

#### A. UART 설정

```bash
sudo raspi-config
```

**설정 메뉴 진행:**

1. `3 Interface Options` 선택
2. `I6 Serial Port` 선택
3. "Login shell over serial?" → **No** 선택
4. "Serial port hardware enabled?" → **Yes** 선택
5. `Finish` → `Yes` (재부팅)

#### B. 부트 설정 확인

```bash
sudo nano /boot/config.txt

# 파일 끝에 다음 라인 추가 (없으면)
enable_uart=1
dtoverlay=disable-bt
```

#### C. 시리얼 포트 권한 설정

```bash
# 사용자를 dialout 그룹에 추가
sudo usermod -a -G dialout pi

# 재부팅
sudo reboot
```

### Step 4: 기본 패키지 설치

```bash
# 필수 패키지 설치
sudo apt install python3-pip python3-venv git sqlite3 -y

# Python 버전 확인
python3 --version
```

---

## Phase 3: RS-485 하드웨어 연결

### Step 1: 연결 다이어그램

```
중량선별기 → RS-485 컨버터 → 라즈베리파이
485+ (A) → A (Yellow) → (데이터 라인)
485- (B) → B (Blue)   → (데이터 라인)
GND     → Gnd (Black) → Pin 9 (GND)
        → Vcc (Red)   → Pin 2 (5V)
        → Ro (Green)  → Pin 10 (GPIO15/RXD)
        → Di (White)  → Pin 8 (GPIO14/TXD)
```

### Step 2: 핀 매핑 상세

| RS-485 모듈         | 케이블 색상 | 라즈베리파이 | GPIO   | 기능            |
| ------------------- | ----------- | ------------ | ------ | --------------- |
| Vcc                 | 빨강        | Pin 2        | +5V    | 전원 공급       |
| Gnd                 | 검정,보라   | Pin 9        | GND    | 접지            |
| Di (Data Input)     | 흰색        | Pin 8        | GPIO14 | UART TXD        |
| Ro (Receive Output) | 초록        | Pin 10       | GPIO15 | UART RXD        |
| A (485+)            | 노랑        | -            | -      | 중량선별기 485+ |
| B (485-)            | 파랑        | -            | -      | 중량선별기 485- |

### Step 3: 연결 순서

#### A. 전원 연결

```
RS-485 Vcc (빨강) → 점퍼선 → Pin 2 (5V)
RS-485 Gnd (검정) → 점퍼선 → Pin 9 (GND)
```

#### B. 데이터 통신선 연결

```
RS-485 Di (흰색) → 점퍼선 → Pin 8 (GPIO14/TXD)
RS-485 Ro (초록) → 점퍼선 → Pin 10 (GPIO15/RXD)
```

#### C. RS-485 라인 + 공통 접지 연결

```
RS-485 A (노랑) → 중량선별기 485+
RS-485 B (파랑) → 중량선별기 485-
중량선별기 GND → 라즈베리파이 Pin 9 (GND와 함께 연결)
```

### Step 4: 연결 확인

```bash
# 시리얼 포트 확인
ls -la /dev/serial* /dev/ttyAMA*

# GPIO 상태 확인
gpio readall
```

---

## Phase 4: 소프트웨어 개발 환경 구축

### Step 1: 프로젝트 폴더 생성

```bash
# 프로젝트 폴더 생성
mkdir ~/checkweigher
cd ~/checkweigher

# 하위 폴더 생성
mkdir -p config modules logs backup test
```

### Step 2: Python 가상환경 설정

```bash
# 가상환경 생성
python3 -m venv venv

# 가상환경 활성화
source venv/bin/activate

# pip 업그레이드
pip install --upgrade pip
```

### Step 3: 필수 라이브러리 설치

```bash
# requirements.txt 생성
cat > requirements.txt << EOF
pyserial
google-auth
google-auth-oauthlib
google-api-python-client
gspread
pandas
requests
schedule
psutil
EOF

# 라이브러리 설치
pip install -r requirements.txt
```

### Step 4: 설정 파일 생성

#### A. settings.json

```bash
cat > config/settings.json << 'EOF'
{
  "serial": {
    "port": "/dev/serial0",
    "baudrate": 9600,
    "bytesize": 8,
    "parity": "N",
    "stopbits": 1,
    "timeout": 1.0,
    "retry_attempts": 3,
    "rtscts": false,
    "dsrdtr": false
  },
  "google_sheets": {
    "spreadsheet_id": "1bf1Rtb5e7MTLtD5Qp3AGbytPMQl4JyZr457sGGc0MVw",
    "sheet_name": "1라인",
    "credentials_file": "credentials.json"
  },
  "local_backup": {
    "db_path": "data/measurements.db",
    "cleanup_days": 30,
    "backup_interval": 300
  },
  "system": {
    "max_retry": 3,
    "log_level": "INFO",
    "log_file": "logs/checkweigher.log",
    "batch_upload_interval_minutes": 5,
    "maintenance_hour": 2
  },
  "device": {
    "device_id": "CHECKWEIGHER_001",
    "location": "생산라인_1",
    "manufacturer": "인테크",
    "model": "중량선별기"
  }
}
EOF
```

### Step 5: Google Sheets API 설정

#### A. Google Cloud Console 설정

1. [Google Cloud Console](https://console.cloud.google.com/) 접속
2. 새 프로젝트 생성: "checkweigher-system"
3. Google Sheets API 활성화
4. 서비스 계정 생성
5. JSON 키 파일 다운로드 → `config/credentials.json`으로 저장

#### B. 스프레드시트 생성

1. Google Sheets에서 새 시트 생성
2. 시트명: "중량선별기\_데이터"
3. 헤더 행 설정: `TIMESTAMP,DATE,TIME,P_No,LOT,COUNT,GRADE,WEIGHT`
4. 서비스 계정 이메일을 편집자로 추가

---

## Phase 5: 시스템 테스트

### Step 1: 기본 테스트 스크립트 생성

#### A. 시리얼 포트 테스트 (test_serial_simple.py)

```python
import serial
import time

# 여러 포트와 보드레이트 테스트
ports = ['/dev/serial0', '/dev/ttyS0', '/dev/ttyAMA0']
bauds = [9600, 4800, 19200, 38400]

for port in ports:
    for baud in bauds:
        try:
            print(f"\n=== 테스트 중: {port} - {baud}bps ===")
            s = serial.Serial(port, baud, timeout=2)

            print("연결 성공! 5초간 대기...")
            for i in range(5):
                if s.in_waiting > 0:
                    data = s.readline().decode('utf-8', errors='ignore').strip()
                    print(f"수신: {data}")
                else:
                    print(".", end="", flush=True)
                time.sleep(1)

            s.close()
            print(" 완료")

        except Exception as e:
            print(f"오류: {e}")
```

#### B. Google Sheets 연결 테스트 (test_sheets.py)

```python
#!/usr/bin/env python3
"""
Google Sheets 연결 테스트 스크립트
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
        spreadsheet = client.open_by_key(spreadsheet_id)
        worksheet = spreadsheet.worksheet(config['google_sheets']['sheet_name'])

        print(f"✅ 워크시트 '{config['google_sheets']['sheet_name']}' 연결 성공")

        # 테스트 데이터 업로드
        test_data = [
            datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            datetime.now().strftime('%Y-%m-%d'),
            datetime.now().strftime('%H:%M:%S'),
            1, 'TEST_LOT_001', 1, 'TEST', 50.5
        ]

        worksheet.append_row(test_data)
        print("✅ 테스트 데이터 업로드 성공!")

        return True

    except Exception as e:
        print(f"❌ 연결 테스트 실패: {e}")
        return False

if __name__ == "__main__":
    print("=" * 60)
    print("🏭 중량선별기 Google Sheets 연결 테스트")
    print("=" * 60)

    if test_google_sheets_connection():
        print("\n🎉 모든 테스트 통과!")
    else:
        print("\n❌ 테스트 실패")
```

### Step 2: 테스트 실행

```bash
# 가상환경 활성화 확인
source venv/bin/activate

# 시리얼 포트 테스트
python test_serial_simple.py

# Google Sheets 테스트
python test_sheets.py
```

### Step 3: 중량선별기 설정 확인

1. 중량선별기 메뉴에서 통신설정 진입
2. Ch.2 (RS-485) 포트 활성화
3. 통신속도: 9600bps 확인
4. 프로토콜: 리모트전송 또는 HM 프로토콜 선택
5. OUTPUT 설정에서 RS-485 출력 ON
6. 출력 조건: 측정 완료 시

---

## Phase 6: 운영 및 유지보수

### Step 1: 시스템 서비스 등록

```bash
# systemd 서비스 파일 생성
sudo nano /etc/systemd/system/checkweigher.service

# 다음 내용 입력:
[Unit]
Description=중량선별기 실시간 데이터 수집 시스템
After=network.target
Wants=network.target

[Service]
Type=simple
User=pi
Group=pi
WorkingDirectory=/home/pi/checkweigher
ExecStart=/home/pi/checkweigher/venv/bin/python /home/pi/checkweigher/main.py
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target

# 서비스 등록 및 시작
sudo systemctl daemon-reload
sudo systemctl enable checkweigher.service
sudo systemctl start checkweigher.service
```

### Step 2: 운영 명령어

#### A. 서비스 관리

```bash
# 서비스 상태 확인
sudo systemctl status checkweigher.service

# 서비스 시작/중지/재시작
sudo systemctl start checkweigher.service
sudo systemctl stop checkweigher.service
sudo systemctl restart checkweigher.service

# 자동 시작 설정/해제
sudo systemctl enable checkweigher.service
sudo systemctl disable checkweigher.service
```

#### B. 로그 확인

```bash
# 실시간 시스템 로그
sudo journalctl -u checkweigher.service -f

# 애플리케이션 로그
tail -f ~/checkweigher/logs/checkweigher.log

# 로그 파일 목록
ls -la ~/checkweigher/logs/
```

#### C. 데이터베이스 확인

```bash
# SQLite 데이터베이스 접속
sqlite3 ~/checkweigher/data/measurements.db

# 테이블 정보 확인
.tables
.schema measurements

# 레코드 수 확인
SELECT COUNT(*) FROM measurements;

# 최근 10개 데이터 확인
SELECT * FROM measurements ORDER BY created_at DESC LIMIT 10;
```

### Step 3: 정기 유지보수

#### A. 일일 점검 항목

- [ ] 시스템 서비스 상태 확인
- [ ] 데이터 수신 정상 여부
- [ ] Google Sheets 업로드 상태
- [ ] 로그 파일 용량 체크

#### B. 주간 점검 항목

- [ ] 시스템 리소스 사용률
- [ ] 로컬 데이터베이스 백업
- [ ] 네트워크 연결 안정성
- [ ] 하드웨어 연결 상태

#### C. 월간 점검 항목

- [ ] OS 업데이트
- [ ] Python 패키지 업데이트
- [ ] 로그 파일 정리
- [ ] 성능 최적화

---

## 문제해결 가이드

### A. SSH 연결 문제

#### 증상: "Connection timed out"

**원인 분석:**

- SSH 서비스가 실행되지 않음
- 방화벽이 22번 포트를 차단
- 네트워크 설정 문제

**해결 방법:**

```bash
# 라즈베리파이에서 직접 실행:

# 1. SSH 서비스 상태 확인
sudo systemctl status ssh

# 2. SSH 서비스 시작/재시작
sudo systemctl start ssh
sudo systemctl restart ssh

# 3. SSH 포트 확인
sudo netstat -tlnp | grep :22

# 4. raspi-config로 SSH 활성화
sudo raspi-config
# Interface Options → SSH → Enable

# 5. 방화벽 확인
sudo ufw status
sudo ufw allow ssh

# 6. 시스템 재부팅
sudo reboot
```

### B. 시리얼 통신 문제

#### 증상: 데이터 수신되지 않음

**원인 분석:**

- 하드웨어 연결 불량
- 시리얼 포트 권한 문제
- 중량선별기 설정 오류

**해결 방법:**

```bash
# 1. 시리얼 포트 확인
ls -la /dev/tty*

# 2. 권한 확인 및 설정
sudo usermod -a -G dialout pi
sudo chmod 666 /dev/ttyAMA0

# 3. UART 설정 확인
sudo raspi-config
# Interface Options → Serial Port

# 4. 부트 설정 확인
sudo nano /boot/config.txt
# enable_uart=1 확인

# 5. 테스트 프로그램 실행
python test_serial_simple.py
```

### C. Google Sheets 연결 문제

#### 증상: API 인증 오류

**해결 방법:**

1. `credentials.json` 파일 위치 확인
2. 서비스 계정 권한 확인
3. 스프레드시트 공유 설정 확인
4. API 할당량 확인

### D. 시스템 성능 문제

#### 증상: 메모리 부족, CPU 과부하

**모니터링 명령어:**

```bash
# 시스템 리소스 확인
htop
free -h
df -h

# 프로세스 확인
ps aux | grep python

# 메모리 사용량이 높은 프로세스
ps aux --sort=-%mem | head
```

---

## 체크리스트

### 설치 완료 체크리스트

- [ ] 라즈베리파이 OS 설치 및 기본 설정
- [ ] SSH 연결 설정 및 테스트
- [ ] UART/시리얼 포트 활성화
- [ ] RS-485 하드웨어 연결
- [ ] Python 가상환경 및 패키지 설치
- [ ] Google Sheets API 설정
- [ ] 설정 파일 작성
- [ ] 시리얼 통신 테스트
- [ ] Google Sheets 연결 테스트
- [ ] systemd 서비스 등록

### 운영 준비 체크리스트

- [ ] 중량선별기 통신 설정 완료
- [ ] 실제 데이터 수신 확인
- [ ] 실시간 업로드 동작 확인
- [ ] 로컬 백업 동작 확인
- [ ] 자동 재시작 설정 확인
- [ ] 로그 모니터링 설정

---

## 지원 및 문의

프로젝트 관련 문의사항이나 기술 지원이 필요한 경우:

1. **시스템 로그 수집**
2. **오류 메시지 캡처**
3. **하드웨어 연결 상태 확인**
4. **설정 파일 검토**

**연락처**: 시스템 관리자 또는 개발팀
