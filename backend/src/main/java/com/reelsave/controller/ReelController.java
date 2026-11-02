package com.reelsave.controller;

import com.reelsave.domain.MediaResult;
import com.reelsave.domain.MediaStatus;
import com.reelsave.domain.ReelUrl;
import com.reelsave.dto.ReelValidationRequest;
import com.reelsave.dto.ReelValidationResponse;
import com.reelsave.provider.DownloadedMedia;
import com.reelsave.provider.MediaDownloadException;
import com.reelsave.provider.MediaDownloadProvider;
import com.reelsave.service.ReelMediaService;
import com.reelsave.service.ReelValidationService;
import jakarta.validation.Valid;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.json.JsonMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;

@RestController
@RequestMapping("/api/v1/reels")
public class ReelController {

    private static final Logger logger = LoggerFactory.getLogger(ReelController.class);
    private static final AtomicBoolean isColdStart = new AtomicBoolean(true);

    private final ReelValidationService reelValidationService;
    private final ReelMediaService reelMediaService;
    private final ObjectProvider<MediaDownloadProvider> downloadProvider;
    private final JsonMapper objectMapper;

    public ReelController(
            ReelValidationService reelValidationService,
            ReelMediaService reelMediaService,
            ObjectProvider<MediaDownloadProvider> downloadProvider,
            JsonMapper objectMapper) {
        this.reelValidationService = reelValidationService;
        this.reelMediaService = reelMediaService;
        this.downloadProvider = downloadProvider;
        this.objectMapper = objectMapper;
    }

    @PostMapping("/validate")
    public ResponseEntity<ReelValidationResponse> validateReelUrl(
            @Valid @RequestBody ReelValidationRequest request,
            @RequestHeader(value = "X-Correlation-ID", required = false) String clientCorrelationId) {
        long startNanos = System.nanoTime();
        String corrId = sanitizeCorrelationId(clientCorrelationId);
        ReelValidationResponse response = reelValidationService.validate(request.url());
        long durationMs = TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - startNanos);
        logger.info("corrId={} method=validate valid={} durationMs={}", corrId, response.valid(), durationMs);

        HttpStatus status = response.valid() ? HttpStatus.OK : HttpStatus.BAD_REQUEST;
        return ResponseEntity.status(status)
                .header("X-Correlation-ID", corrId)
                .header("Server-Timing", "validate;dur=" + durationMs)
                .body(response);
    }

    @PostMapping("/resolve")
    public ResponseEntity<?> resolveReel(
            @Valid @RequestBody ReelValidationRequest request,
            @RequestHeader(value = "X-Correlation-ID", required = false) String clientCorrelationId) {
        long startNanos = System.nanoTime();
        String corrId = sanitizeCorrelationId(clientCorrelationId);
        boolean cold = isColdStart.getAndSet(false);

        Optional<ReelUrl> reelUrl = reelValidationService.parseReelUrl(request.url());
        long valDurationMs = TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - startNanos);
        if (reelUrl.isEmpty()) {
            logger.info("corrId={} method=resolve result=INVALID_URL durationMs={}", corrId, valDurationMs);
            return ResponseEntity.badRequest()
                    .header("X-Correlation-ID", corrId)
                    .header("X-Cold-Start", Boolean.toString(cold))
                    .body(ReelValidationResponse.invalidInstagramReel());
        }

        String shortcode = shortcode(reelUrl.get());
        boolean cacheHit = reelMediaService.cache() != null && reelMediaService.cache().get(shortcode).isPresent();

        long resolveStartNanos = System.nanoTime();
        MediaResult result = reelMediaService.resolve(reelUrl.get());
        long resolveDurationMs = TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - resolveStartNanos);
        long totalDurationMs = TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - startNanos);

        logger.info("corrId={} method=resolve shortcode={} status={} cacheHit={} coldStart={} resolveMs={} totalMs={}",
                corrId, shortcode, result != null ? result.status() : "NULL", cacheHit, cold, resolveDurationMs, totalDurationMs);

        if (result == null) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .header("X-Correlation-ID", corrId)
                    .build();
        }

        return ResponseEntity.status(toHttpStatus(result.status()))
                .header("X-Correlation-ID", corrId)
                .header("X-Cold-Start", Boolean.toString(cold))
                .header("X-Cache", cacheHit ? "HIT" : "MISS")
                .header("Server-Timing", "total;dur=" + totalDurationMs + ", resolve;dur=" + resolveDurationMs)
                .body(result);
    }

    /** Accepts only a validated Instagram Reel URL; it never acts as a caller-directed proxy. */
    @PostMapping("/download")
    public ResponseEntity<StreamingResponseBody> downloadReel(@RequestParam String url) {
        if (url.length() > 2048) {
            return jsonResponse(HttpStatus.BAD_REQUEST, ReelValidationResponse.invalidInstagramReel());
        }

        Optional<ReelUrl> reelUrl = reelValidationService.parseReelUrl(url);
        if (reelUrl.isEmpty()) {
            return jsonResponse(HttpStatus.BAD_REQUEST, ReelValidationResponse.invalidInstagramReel());
        }

        MediaDownloadProvider provider = downloadProvider.getIfAvailable();
        if (provider == null) {
            return jsonResponse(HttpStatus.SERVICE_UNAVAILABLE, MediaResult.unavailable());
        }

        DownloadedMedia downloadedMedia;
        try {
            downloadedMedia = provider.download(reelUrl.get());
        } catch (MediaDownloadException exception) {
            MediaResult failure = new MediaResult(
                    exception.status(), null, null, null, null, null, null, exception.getMessage());
            return jsonResponse(toHttpStatus(exception.status()), failure);
        }

        StreamingResponseBody body = output -> {
            try (downloadedMedia; InputStream input = java.nio.file.Files.newInputStream(downloadedMedia.file())) {
                input.transferTo(output);
                output.flush();
            } catch (IOException exception) {
                logger.warn("Unable to complete a media download response.");
                throw exception;
            }
        };

        return ResponseEntity.ok()
                .contentType(MediaType.valueOf("video/mp4"))
                .contentLength(downloadedMedia.sizeBytes())
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment()
                        .filename(downloadedMedia.filename(), StandardCharsets.UTF_8)
                        .build()
                        .toString())
                .header(HttpHeaders.CACHE_CONTROL, "no-store")
                .header("X-Content-Type-Options", "nosniff")
                .body(body);
    }

    private ResponseEntity<StreamingResponseBody> jsonResponse(HttpStatus status, Object body) {
        try {
            byte[] bytes = objectMapper.writeValueAsBytes(body);
            StreamingResponseBody responseBody = output -> output.write(bytes);
            return ResponseEntity.status(status)
                    .contentType(MediaType.APPLICATION_JSON)
                    .contentLength(bytes.length)
                    .body(responseBody);
        } catch (JacksonException exception) {
            logger.error("Unable to serialize a safe media response.");
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    private HttpStatus toHttpStatus(MediaStatus status) {
        return switch (status) {
            case READY -> HttpStatus.OK;
            case PROCESSING -> HttpStatus.ACCEPTED;
            case UNAVAILABLE -> HttpStatus.SERVICE_UNAVAILABLE;
            case ERROR -> HttpStatus.BAD_GATEWAY;
        };
    }

    private static String sanitizeCorrelationId(String raw) {
        if (raw == null || raw.isBlank()) {
            return UUID.randomUUID().toString().substring(0, 8);
        }
        String cleaned = raw.replaceAll("[^a-zA-Z0-9_-]", "");
        return cleaned.length() > 64 ? cleaned.substring(0, 64) : cleaned;
    }

    private static String shortcode(ReelUrl reelUrl) {
        String path = reelUrl.uri().getPath();
        String value = path.substring("/reel/".length());
        return value.endsWith("/") ? value.substring(0, value.length() - 1) : value;
    }
}
