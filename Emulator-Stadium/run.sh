#!/bin/bash

set -e

echo
echo "OpsLite - Emulator Stadium"
echo

if ! command -v python3 >/dev/null 2>&1; then
  echo "python3 não está instalado ou não está no PATH."
  exit 1
fi

if [ ! -d "venv" ]; then
  echo "Criando ambiente virtual..."
  if ! python3 -m venv venv; then
    echo
    echo "Não foi possível criar a venv."
    echo "Em Ubuntu/Debian instala primeiro:"
    echo "  sudo apt install python3.13-venv"
    echo
    echo "Se a tua versão for outra, usa o pacote correspondente, por exemplo python3.12-venv."
    exit 1
  fi
fi

source venv/bin/activate

echo "Instalando/atualizando dependências..."
python -m pip install --upgrade pip -q
python -m pip install -r requirements.txt -q

echo
echo "A iniciar simulação..."
if [ -n "${1:-}" ]; then
  python simulator/dragao_simulator.py "$1"
else
  python simulator/dragao_simulator.py
fi

echo
echo "Simulação concluída."
read -p "Pressione Enter para fechar..."
