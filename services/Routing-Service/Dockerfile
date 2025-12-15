FROM python:3.11-slim
WORKDIR /app
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
COPY wait-for-map-service.sh /wait-for-map-service.sh
# Ensure Unix line endings and executable bit (handles Windows CRLF checkouts)
RUN sed -i 's/\r$//' /wait-for-map-service.sh && chmod +x /wait-for-map-service.sh
EXPOSE 8002
CMD ["/wait-for-map-service.sh", "map-service-host", "8000", "python", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8002"]
