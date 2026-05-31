Run Hardware input

serial_to_gis_bridge.py accepts hardware input or mock values.

Get token from
Windows (PowerShell):
curl -X POST http://localhost:8081/auth/login ^
  -H "Content-Type: application/json" ^
  -d "{\"username\":\"<SUPERVISOR_USERNAME>\",\"password\":\"<PASSWORD>\"}"

Linux/macOS (bash):
curl -X POST http://localhost:8081/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"<SUPERVISOR_USERNAME>","password":"<PASSWORD>"}'

for mock
Windows (PowerShell):
$env:SUPERVISOR_TOKEN = "<PASTE_TOKEN_HERE>"
$env:MOCK_MODE = "1"
$env:MOCK_COUNTS = "12,18,25,33,45,60,48,30"
$env:MOCK_INTERVAL_SEC = "2"
python .\serial_to_gis_bridge.py

Linux/macOS (bash):
export SUPERVISOR_TOKEN="<PASTE_TOKEN_HERE>"
export MOCK_MODE="1"
export MOCK_COUNTS="12,18,25,33,45,60,48,30"
export MOCK_INTERVAL_SEC="2"
python ./serial_to_gis_bridge.py

for hardware:
Windows (PowerShell):
$env:SERIAL_PORT = "COM4"     # change if different
$env:SERIAL_BAUD = "115200"
$env:SUPERVISOR_TOKEN = "<PASTE_TOKEN_HERE>"
$env:MOCK_MODE = "0"
python .\serial_to_gis_bridge.py

Linux/macOS (bash):
export SERIAL_PORT="/dev/ttyUSB0"  # change if different
export SERIAL_BAUD="115200"
export SUPERVISOR_TOKEN="<PASTE_TOKEN_HERE>"
export MOCK_MODE="0"
python ./serial_to_gis_bridge.py