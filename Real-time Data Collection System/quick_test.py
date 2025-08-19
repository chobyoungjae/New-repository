#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
가장 간편한 RS-485 통신 테스트 스크립트
하이퍼터미널 대신 사용 가능
"""

import serial
import time

def quick_serial_test():
    """여러 포트와 보드레이트로 자동 테스트"""
    
    # 테스트할 포트들 (Windows)
    ports = ['COM3', 'COM4', 'COM5', 'COM6']
    baudrates = [9600, 19200, 38400, 115200]
    
    print("=== RS-485 간편 통신 테스트 ===")
    print("Ctrl+C로 종료\n")
    
    for port in ports:
        for baud in baudrates:
            try:
                print(f"테스트: {port} @ {baud}bps")
                
                # 시리얼 포트 열기
                ser = serial.Serial(
                    port=port,
                    baudrate=baud,
                    bytesize=8,
                    parity='N',
                    stopbits=1,
                    timeout=2
                )
                
                print(f"✓ {port} 연결 성공!")
                print("데이터 수신 대기중... (5초)")
                
                # 5초간 데이터 수신 시도
                start_time = time.time()
                while time.time() - start_time < 5:
                    if ser.in_waiting > 0:
                        data = ser.read(ser.in_waiting)
                        print(f"수신 데이터: {data}")
                        print(f"ASCII 변환: {data.decode('utf-8', errors='ignore')}")
                        break
                    time.sleep(0.1)
                else:
                    print("5초간 데이터 없음")
                
                ser.close()
                print("-" * 40)
                
            except Exception as e:
                print(f"✗ {port} @ {baud}: {str(e)}")
                continue
    
    print("테스트 완료!")

if __name__ == "__main__":
    try:
        quick_serial_test()
    except KeyboardInterrupt:
        print("\n테스트 중단됨")