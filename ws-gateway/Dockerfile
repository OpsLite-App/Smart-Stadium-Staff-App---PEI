# Stage 1: Build Java app
FROM maven:3.9.4-eclipse-temurin-21 AS build
WORKDIR /src

COPY pom.xml .
COPY src src

RUN mvn -DskipTests package -e -B

# Stage 2: Runtime
FROM eclipse-temurin:21-jre
WORKDIR /app

# Install Python, pip, and netcat
RUN apt-get update && \
    apt-get install -y python3 python3-pip netcat-openbsd && \
    rm -rf /var/lib/apt/lists/*

# Copy Python requirements
COPY requirements.txt .

# Install Python dependencies (PEP 668 compatible)
RUN pip3 install --no-cache-dir --break-system-packages -r requirements.txt

# Copy Java JAR
COPY --from=build /src/target/ws-gateway-0.0.1-SNAPSHOT.jar app.jar

# Copy MQTT wait script
COPY wait-for-mqtt.py /wait-for-mqtt.py
RUN chmod +x /wait-for-mqtt.py

EXPOSE 8089
ENTRYPOINT ["java","-jar","/app/app.jar"]
