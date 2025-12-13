FROM python:3.11-slim
WORKDIR /app
# Install common tooling
RUN pip install --no-cache-dir paho-mqtt requests
COPY services/event_processor.py ./event_processor.py
CMD ["python", "event_processor.py"]
