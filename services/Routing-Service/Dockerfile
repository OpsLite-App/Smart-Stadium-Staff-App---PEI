FROM python:3.11-slim
WORKDIR /app
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*
COPY Routing-Service/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY Routing-Service/. .
COPY cache_config.py .
EXPOSE 8002
CMD ["python", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8002"]
