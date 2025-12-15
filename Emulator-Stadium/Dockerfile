FROM python:3.11-slim
WORKDIR /app

# Install curl and netcat
RUN apt-get update && apt-get install -y curl netcat-openbsd && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY simulator simulator
COPY wait-for-all-services.sh /wait-for-all-services.sh
RUN chmod +x /wait-for-all-services.sh
CMD ["/wait-for-all-services.sh","8000", "python", "simulator/dragao_simulator.py"]
