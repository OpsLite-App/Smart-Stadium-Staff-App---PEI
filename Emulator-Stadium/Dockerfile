FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY simulator simulator
# No port - emulator runs as worker
CMD ["python", "simulator/dragao_simulator.py"]
