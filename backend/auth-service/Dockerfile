# Build and run the auth-service
FROM maven:3.9.4-eclipse-temurin-21 as build
WORKDIR /src
COPY pom.xml mvnw .
COPY .mvn .mvn
COPY src src
RUN mvn -DskipTests package -e -B

FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=build /src/target/auth-service-0.0.1-SNAPSHOT.jar app.jar
EXPOSE 8081
ENTRYPOINT ["java","-jar","/app/app.jar"]
