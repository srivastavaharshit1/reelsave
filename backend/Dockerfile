# ==========================================
# Stage 1: Build JAR with Maven & Java 21
# ==========================================
FROM maven:3.9-eclipse-temurin-21-alpine AS builder

WORKDIR /app

COPY pom.xml ./
RUN mvn dependency:go-offline -B

COPY src ./src
RUN mvn clean package -DskipTests

# ==========================================
# Stage 2: Production JRE 21 + yt-dlp Runtime
# ==========================================
FROM eclipse-temurin:21-jre-alpine

# Install genuinely required runtime dependencies: Python 3, CA certificates, and curl
RUN apk add --no-cache python3 ca-certificates curl

# Download and verify official yt-dlp release binary
ARG YTDLP_VERSION=2026.10.21
RUN curl -sSL "https://github.com/yt-dlp/yt-dlp/releases/download/${YTDLP_VERSION}/yt-dlp" -o /usr/local/bin/yt-dlp \
    && chmod a+rx /usr/local/bin/yt-dlp \
    && /usr/local/bin/yt-dlp --version

WORKDIR /app

# Run as non-root user for security with dedicated writable temp directory
RUN addgroup -S reelsave && adduser -S reelsave -G reelsave && \
    mkdir -p /app/tmp && chown -R reelsave:reelsave /app

USER reelsave:reelsave

COPY --from=builder /app/target/reelsave-api-0.1.0-SNAPSHOT.jar app.jar

ENV PORT=8080
ENV MEDIA_PROVIDER=ytdlp
ENV YTDLP_EXECUTABLE=/usr/local/bin/yt-dlp
ENV YTDLP_TIMEOUT_SECONDS=30
ENV YTDLP_DOWNLOAD_TIMEOUT_SECONDS=120
ENV YTDLP_MAX_DOWNLOAD_BYTES=52428800

EXPOSE 8080

ENTRYPOINT ["java", "-Djava.security.egd=file:/dev/./urandom", "-Djava.io.tmpdir=/app/tmp", "-jar", "app.jar"]
