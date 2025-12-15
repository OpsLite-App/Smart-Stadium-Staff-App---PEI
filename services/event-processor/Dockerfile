FROM python:3.11-slim
WORKDIR /app

# Install common tooling
RUN apt-get update && apt-get install -y curl netcat-openbsd && rm -rf /var/lib/apt/lists/*
RUN pip install --upgrade pip
RUN pip install --no-cache-dir requests
RUN pip install --upgrade paho-mqtt>=2.0.0


# Copy scripts and app
COPY event-processor/wait-for-mqtt.py /wait-for-mqtt.py
COPY event_processor.py ./event_processor.py
COPY event-processor/wait-for-all-services.sh /wait-for-all-services.sh
RUN chmod +x /wait-for-all-services.sh

# Use the new wait-for-all-services.sh as entrypoint
CMD ["/wait-for-all-services.sh"]
