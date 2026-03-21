"""
Mock STM32 — simulates the STM32 serial output for testing without hardware.
Uses socat to create a virtual serial port pair.

Usage:
    # Terminal 1 — create virtual serial ports:
    socat -d -d pty,raw,echo=0,link=/tmp/ttySTM32_TX pty,raw,echo=0,link=/tmp/ttySTM32_RX

    # Terminal 2 — run this mock (writes to TX):
    python mock_stm32.py

    # Terminal 3 — run the bridge (reads from RX):
    SERIAL_PORT=/tmp/ttySTM32_RX python stm32_bridge.py
"""

import serial, json, time, random

SERIAL_PORT = "/tmp/ttySTM32_TX"
BAUD_RATE   = 115200
INTERVAL    = 2  # seconds between readings

print(f"Mock STM32 sending to {SERIAL_PORT} every {INTERVAL}s")
print("Make sure socat is running first!\n")

with serial.Serial(SERIAL_PORT, BAUD_RATE) as ser:
    while True:
        people = random.randint(0, 8)
        msg = json.dumps({"people": people}) + "\n"
        ser.write(msg.encode())
        print(f"STM32 → {msg.strip()}")
        time.sleep(INTERVAL)
