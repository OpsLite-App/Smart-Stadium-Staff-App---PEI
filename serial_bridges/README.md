Before running this script, make sure board is flashable with the model, and run it.

serial_bridge will wait for connection from hardware broker and app services before doing anything.

If no env variables are passed, it will run with default values, which are Windows variables.

Windows:
$env:SERIAL_PORT="COM4"
$env:SERIAL_BAUD="115200"
python .\serial_bridge.py

Linux / macOS
export SERIAL_PORT="/dev/ttyUSB0"
export SERIAL_BAUD="115200"
python ./serial_bridge.py