# Build and run the WS Gateway
FROM maven:3.9.4-eclipse-temurin-21 as build
WORKDIR /src
COPY pom.xml .
COPY src src
RUN mvn -DskipTests package -e -B

FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=build /src/target/ws-gateway-0.0.1-SNAPSHOT.jar app.jar
EXPOSE 8089
ENTRYPOINT ["java","-jar","/app/app.jar"]
