# ==============================================================================
# FocusLift Backend - Multi-stage Dockerfile (Java 21 + Spring Boot 3)
# ==============================================================================

# Estágio 1: Build da aplicação com Maven
FROM maven:3.9.9-eclipse-temurin-21-alpine AS builder
WORKDIR /app

# Cache inteligente de dependências do Maven
COPY pom.xml .
RUN mvn dependency:go-offline -B

# Copia código-fonte e compila pacote final (JAR)
COPY src ./src
RUN mvn clean package -DskipTests -B

# Estágio 2: Imagem final enxuta para execução (distroless/JRE leve)
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app

# Usuário não-root por segurança
RUN addgroup -S focuslift && adduser -S focuslift -G focuslift
USER focuslift

COPY --from=builder /app/target/focuslift-backend-1.0.0.jar app.jar

# Calibrado para ambientes Cloud com restrição de memória (Render / Railway / 512MB RAM)
ENV PORT=8080 \
    JAVA_OPTS="-Xms128m -Xmx320m -XX:+UseG1GC -XX:+ExitOnOutOfMemoryError"

EXPOSE 8080

ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar app.jar"]
