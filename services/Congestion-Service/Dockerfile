FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN python -m pip install --upgrade pip && pip install --no-cache-dir -r requirements.txt
COPY . .
# Copy and use MQTT wait helper
COPY wait-for-mqtt.py /wait-for-mqtt.py
EXPOSE 8005
HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=3 CMD python -c "import urllib.request,sys; r=urllib.request.urlopen('http://localhost:8005/'); sys.exit(0 if r.getcode()<400 else 1)"
CMD ["sh", "-c", "python /wait-for-mqtt.py && python -m uvicorn congestion_service:app --host 0.0.0.0 --port 8005"]
