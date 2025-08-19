#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
리모트(폴링) 프로토콜 장비용 RS-485 폴링 테스트 스크립트

사용 목적
- 중량선별기에서 '리모트 전송 프로토콜'을 선택한 경우, 장비가 자발적으로 데이터를 내보내지 않고
  마스터(라즈베리파이)가 주기적으로 명령을 보내야 응답이 오는 경우가 많습니다.
- 본 스크립트는 여러 보편적인 폴링 명령을 순차적으로 전송하고, 들어오는 모든 바이트를 원시/ASCII로 출력합니다.

주의 사항
- RS-485 배선(A/B)과 포트 종류(RS-232/RS-485) 확인이 선행되어야 합니다.
- USB-RS485 컨버터는 일반적으로 자동 방향 제어를 지원하지만, TTL-RS485 모듈 사용 시 TX 방향(De/RE) 제어가 필요할 수 있습니다.
"""

import os
import sys
import time
import json
import argparse
import serial
try:
    from serial.rs485 import RS485Settings
except Exception:
    RS485Settings = None


def load_settings(default_port: str, default_baud: int):
	"""설정 파일(`config/settings.json`)에서 기본 포트/보드레이트를 로드합니다.
	없거나 오류일 경우 인자로 받은 기본값을 반환합니다.
	"""
	settings_path = os.path.join(os.path.dirname(__file__), 'config', 'settings.json')
	try:
		with open(settings_path, 'r', encoding='utf-8') as f:
			cfg = json.load(f)
			serial_cfg = cfg.get('serial', {})
			return (
				serial_cfg.get('port', default_port),
				int(serial_cfg.get('baudrate', default_baud)),
				int(serial_cfg.get('bytesize', 8)),
				serial_cfg.get('parity', 'N'),
				int(serial_cfg.get('stopbits', 1)),
				float(serial_cfg.get('timeout', 1.0)),
			)
	except Exception:
		return default_port, default_baud, 8, 'N', 1, 1.0


def open_serial_port(port: str, baudrate: int, bytesize: int, parity: str, stopbits: int, timeout: float, rs485: bool = False) -> serial.Serial:
	"""시리얼 포트를 여는 함수. 예외 발생 시 명확한 메시지 반환.
	- 한글 주석으로 맥락 설명
	- 예외는 상위에서 처리
	"""
	parity_const = getattr(serial, f'PARITY_{parity.upper()}', serial.PARITY_NONE)

	# 먼저 포트를 연 다음, 지원 시 RS-485 모드를 속성으로 설정한다
	ser = serial.Serial(
		port=port,
		baudrate=baudrate,
		bytesize=bytesize,
		parity=parity_const,
		stopbits=stopbits,
		timeout=timeout,
	)

	# RS-485 방향 제어가 필요한 경우 rs485_mode 설정(커널/드라이버 및 pyserial 버전 지원 필요)
	if rs485 and RS485Settings is not None:
		try:
			ser.rs485_mode = RS485Settings(
				rts_level_for_tx=True,
				rts_level_for_rx=False,
				delay_before_tx=0,
				delay_before_rx=0,
				loopback=False,
			)
		except Exception:
			# 지원되지 않으면 그냥 경고만 출력하고 일반 모드로 진행
			print('⚠️ RS-485 모드 설정을 지원하지 않는 환경입니다. 일반 Serial 모드로 진행합니다.')
	return ser



def try_poll_once(ser: serial.Serial, poll_bytes: bytes, wait_seconds: float = 0.3) -> bytes:
	"""폴링 명령 1회 전송 후 wait_seconds 동안 들어오는 데이터를 수신합니다."""
	# 남아있는 버퍼 비우기
	try:
		while ser.in_waiting:
			ser.read(ser.in_waiting)
	except Exception:
		pass

	# 폴링 명령 전송
	ser.write(poll_bytes)
	ser.flush()
	time.sleep(wait_seconds)

	# 응답 수집
	recv = b''
	try:
		if ser.in_waiting > 0:
			recv = ser.read(ser.in_waiting)
	except Exception:
		pass
	return recv


def format_bytes_as_hex(data: bytes) -> str:
	"""바이트 데이터를 공백 구분 16진수 문자열로 변환"""
	return ' '.join(f'{b:02X}' for b in data)


def main():
	parser = argparse.ArgumentParser(description='RS-485 리모트 폴링 테스트 도구')
	parser.add_argument('--port', type=str, default=None, help='시리얼 포트 (예: /dev/serial0, /dev/ttyAMA0, /dev/ttyUSB0)')
	parser.add_argument('--baud', type=int, default=None, help='보드레이트 (기본: 설정 파일 또는 9600)')
	parser.add_argument('--tries', type=int, default=0, help='각 명령 반복 횟수(0이면 무한 루프)')
	parser.add_argument('--interval', type=float, default=0.8, help='명령 사이 전송 간격(초)')
	parser.add_argument('--rs485', action='store_true', help='RS-485 방향 제어 활성화(커널/드라이버 지원 필요)')
	args = parser.parse_args()

	# 설정 파일/인자에서 기본값 로드
	default_port = '/dev/serial0'
	default_baud = 9600
	port, baudrate, bytesize, parity, stopbits, timeout = load_settings(default_port, default_baud)

	if args.port:
		port = args.port
	if args.baud:
		baudrate = args.baud

	# 보편적으로 사용되는 폴링 명령 후보 목록
	# 장비 매뉴얼에 따라 다르므로 필요한 경우 직접 수정
	COMMON_POLL_COMMANDS = [
		b'R\r',            # R + CR
		b'R\r\n',          # R + CRLF
		b'Q\r',            # Q + CR
		b'Q\r\n',          # Q + CRLF
		b'W\r',            # W + CR
		b'W\r\n',          # W + CRLF
		b'\x05',           # ENQ
		b'\x02R\x03',      # STX R ETX
		b'\x02RD\x03',     # STX R D ETX
		b'\r',             # CR 단독
		b'\r\n',           # CRLF 단독
		b'?\r',            # ? + CR
	]

	print('=' * 60)
	print('🛰  RS-485 리모트 폴링 테스트')
	print('=' * 60)
	print(f'포트: {port}, 보드레이트: {baudrate}, 포맷: {bytesize}{parity}{stopbits}, 타임아웃: {timeout}s')

	# 포트 열기
	try:
		ser = open_serial_port(port, baudrate, bytesize, parity, stopbits, timeout, rs485=args.rs485)
		print(f'✅ 시리얼 포트 열림: {ser.name}')
	except Exception as e:
		print(f'❌ 시리얼 포트 오픈 실패: {e}')
		print('🔧 확인: 포트 경로, 권한(dialout), enable_uart=1, 케이블 연결')
		return 1

	try:
		iteration = 0
		while True:
			for cmd in COMMON_POLL_COMMANDS:
				print(f"\n➡️  송신: {format_bytes_as_hex(cmd)}  (len={len(cmd)})")
				recv = try_poll_once(ser, cmd, wait_seconds=0.3)
				if recv:
					print(f"📥 수신 Raw({len(recv)}): {format_bytes_as_hex(recv)}")
					try:
						ascii_data = recv.decode('ascii', errors='replace').strip()
						if ascii_data:
							print(f"🔤 ASCII: '{ascii_data}'")
					except Exception:
						pass
				else:
					print('🚫 응답 없음')
				time.sleep(args.interval)

			# 지정된 반복 횟수만 실행하도록 옵션 제공
			if args.tries > 0:
				iteration += 1
				if iteration >= args.tries:
					break
		if args.tries > 0:
			print('\n🔚 시도 횟수 도달, 종료')
		else:
			print('\n🔚 사용자 종료')
	finally:
		try:
			ser.close()
			print('🔒 시리얼 포트 닫힘')
		except Exception:
			pass

	return 0


if __name__ == '__main__':
	sys.exit(main())


