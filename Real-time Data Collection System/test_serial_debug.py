#!/usr/bin/env python3
"""
RS-485 시리얼 포트 진단 및 테스트 스크립트
데이터 수신이 되지 않는 문제를 단계별로 진단합니다.
"""

import serial
import time
import json
import os
import sys

def load_config():
    """설정 파일을 로드합니다."""
    try:
        with open('config/settings.json', 'r', encoding='utf-8') as f:
            return json.load(f)
    except FileNotFoundError:
        print("❌ settings.json 파일을 찾을 수 없습니다.")
        return None
    except json.JSONDecodeError:
        print("❌ settings.json 파일 형식이 잘못되었습니다.")
        return None

def check_serial_ports():
    """사용 가능한 시리얼 포트를 확인합니다."""
    print("🔍 시리얼 포트 확인 중...")
    
    possible_ports = ['/dev/serial0', '/dev/ttyAMA0', '/dev/ttyS0', '/dev/ttyUSB0']
    available_ports = []
    
    for port in possible_ports:
        if os.path.exists(port):
            available_ports.append(port)
            print(f"✅ {port} - 포트 존재")
        else:
            print(f"❌ {port} - 포트 없음")
    
    return available_ports

def test_serial_connection(config):
    """시리얼 연결을 테스트합니다."""
    if not config:
        return False
        
    serial_config = config['serial']
    port = serial_config['port']
    baudrate = serial_config['baudrate']
    
    print(f"\n🔌 시리얼 연결 테스트: {port} @ {baudrate}bps")
    
    try:
        # 시리얼 포트 설정
        ser = serial.Serial(
            port=port,
            baudrate=baudrate,
            bytesize=serial_config['bytesize'],
            parity=getattr(serial, f"PARITY_{serial_config['parity']}"),
            stopbits=serial_config['stopbits'],
            timeout=serial_config['timeout'],
            rtscts=serial_config.get('rtscts', False),
            dsrdtr=serial_config.get('dsrdtr', False)
        )
        
        print(f"✅ 시리얼 포트 연결 성공: {ser.name}")
        print(f"📊 설정: {ser.baudrate}bps, {ser.bytesize}{ser.parity}{ser.stopbits}")
        print(f"⏱️  타임아웃: {ser.timeout}초")
        
        return ser
        
    except serial.SerialException as e:
        print(f"❌ 시리얼 포트 연결 실패: {e}")
        print("\n🔧 해결 방법:")
        print("1. 하드웨어 연결 상태 확인")
        print("2. sudo usermod -a -G dialout $USER")
        print("3. sudo reboot")
        return None
    except Exception as e:
        print(f"❌ 예상치 못한 오류: {e}")
        return None

def listen_for_data(ser, duration=30):
    """지정된 시간 동안 데이터를 수신합니다."""
    print(f"\n📡 데이터 수신 대기 중... ({duration}초)")
    print("중량선별기에서 측정을 진행해주세요.")
    print("-" * 50)
    
    start_time = time.time()
    data_received = False
    byte_count = 0
    
    try:
        while time.time() - start_time < duration:
            if ser.in_waiting > 0:
                # 원시 바이트 데이터 읽기
                raw_data = ser.read(ser.in_waiting)
                byte_count += len(raw_data)
                
                # 바이트 데이터 출력 (16진수)
                hex_data = ' '.join([f'{b:02X}' for b in raw_data])
                print(f"📥 Raw bytes ({len(raw_data)}): {hex_data}")
                
                # ASCII 변환 시도
                try:
                    ascii_data = raw_data.decode('ascii', errors='replace').strip()
                    if ascii_data:
                        print(f"📄 ASCII: '{ascii_data}'")
                        data_received = True
                except:
                    pass
                
                # UTF-8 변환 시도
                try:
                    utf8_data = raw_data.decode('utf-8', errors='replace').strip()
                    if utf8_data and utf8_data != ascii_data:
                        print(f"🔤 UTF-8: '{utf8_data}'")
                except:
                    pass
                
                print("-" * 30)
            
            time.sleep(0.1)
    
    except KeyboardInterrupt:
        print("\n⏹️  사용자가 중단했습니다.")
    
    print(f"\n📊 수신 통계:")
    print(f"   총 바이트 수: {byte_count}")
    print(f"   데이터 수신: {'✅ 성공' if data_received else '❌ 실패'}")
    
    return data_received

def test_different_ports():
    """다른 포트들로 테스트해봅니다."""
    print("\n🔄 다른 시리얼 포트들로 테스트...")
    
    ports_to_test = ['/dev/ttyAMA0', '/dev/ttyS0', '/dev/serial0']
    
    for port in ports_to_test:
        if not os.path.exists(port):
            continue
            
        print(f"\n🧪 {port} 테스트 중...")
        
        try:
            ser = serial.Serial(
                port=port,
                baudrate=9600,
                bytesize=8,
                parity=serial.PARITY_NONE,
                stopbits=1,
                timeout=1
            )
            
            print(f"✅ {port} 연결 성공")
            
            # 5초간 데이터 확인
            print("5초간 데이터 수신 확인...")
            start = time.time()
            while time.time() - start < 5:
                if ser.in_waiting > 0:
                    data = ser.read(ser.in_waiting)
                    hex_data = ' '.join([f'{b:02X}' for b in data])
                    print(f"📥 {port}: {hex_data}")
                time.sleep(0.1)
            
            ser.close()
            
        except Exception as e:
            print(f"❌ {port} 실패: {e}")

def main():
    """메인 진단 함수"""
    print("🔧 RS-485 시리얼 포트 진단 도구")
    print("=" * 50)
    
    # 1. 설정 파일 로드
    print("\n1️⃣ 설정 파일 확인")
    config = load_config()
    if config:
        print("✅ 설정 파일 로드 성공")
        print(f"📍 설정된 포트: {config['serial']['port']}")
    else:
        print("❌ 설정 파일 로드 실패")
        return
    
    # 2. 시리얼 포트 확인
    print("\n2️⃣ 시리얼 포트 확인")
    available_ports = check_serial_ports()
    
    if not available_ports:
        print("❌ 사용 가능한 시리얼 포트가 없습니다.")
        print("\n🔧 해결 방법:")
        print("1. sudo raspi-config에서 Serial Port 활성화")
        print("2. /boot/config.txt에서 enable_uart=1 확인")
        print("3. sudo reboot")
        return
    
    # 3. 시리얼 연결 테스트
    print("\n3️⃣ 시리얼 연결 테스트")
    ser = test_serial_connection(config)
    
    if not ser:
        print("\n🔄 다른 포트로 테스트 시도...")
        test_different_ports()
        return
    
    # 4. 데이터 수신 테스트
    print("\n4️⃣ 데이터 수신 테스트")
    try:
        data_received = listen_for_data(ser, duration=30)
        
        if not data_received:
            print("\n❌ 데이터가 수신되지 않았습니다.")
            print("\n🔧 중량선별기 설정 확인사항:")
            print("1. MENU → SETUP → COMMUNICATION")
            print("2. Ch.2 (RS-485) 포트 활성화")
            print("3. Baud Rate: 9600 확인")
            print("4. Protocol: Remote 또는 HM 선택")
            print("5. OUTPUT 설정에서 RS-485 출력 ON")
            print("6. 출력 조건: 측정 완료 시")
            
            print("\n🔌 하드웨어 연결 재확인:")
            print("1. 485+ (A) ↔ A 터미널")
            print("2. 485- (B) ↔ B 터미널")
            print("3. GND 연결 확인")
            print("4. 전원 공급 확인 (5V)")
        else:
            print("\n✅ 데이터 수신 성공!")
            
    finally:
        ser.close()
        print("\n🔚 진단 완료")

if __name__ == "__main__":
    main()