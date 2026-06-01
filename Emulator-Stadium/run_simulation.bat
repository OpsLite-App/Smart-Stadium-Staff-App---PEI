@echo off
echo.
echo OpsLite - Emulator Stadium
echo.

if not exist "venv\Scripts\python.exe" (
    echo Criando ambiente virtual...
    python -m venv venv
    echo.
)

call venv\Scripts\activate.bat

echo Instalando/atualizando dependencias...
python -m pip install --upgrade pip -q
python -m pip install -r requirements.txt -q

echo.
echo A iniciar simulacao...
python simulator\dragao_simulator.py %1

echo.
echo Simulacao terminada.
pause
