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