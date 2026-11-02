package com.reelsave.security;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.time.Duration;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ProblemDetail;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;
import tools.jackson.databind.json.JsonMapper;

/** Applies a bounded per-remote-address limit to public Reel operations. */
@Component
public final class ClientRateLimitInterceptor implements HandlerInterceptor {

    private final boolean enabled;
    private final ClientRateLimiter limiter;
    private final JsonMapper objectMapper;

    public ClientRateLimitInterceptor(
            JsonMapper objectMapper,
            @Value("${reelsave.rate-limit.enabled:true}") boolean enabled,
            @Value("${reelsave.rate-limit.requests-per-window:30}") int requestsPerWindow,
            @Value("${reelsave.rate-limit.window-seconds:60}") long windowSeconds,
            @Value("${reelsave.rate-limit.maximum-clients:10000}") int maximumClients) {
        if (windowSeconds < 1 || windowSeconds > 3600) {
            throw new IllegalArgumentException("Rate limit window must be between 1 and 3600 seconds.");
        }
        this.enabled = enabled;
        this.limiter = new ClientRateLimiter(
                requestsPerWindow, Duration.ofSeconds(windowSeconds), maximumClients);
        this.objectMapper = objectMapper;
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler)
            throws IOException {
        if (!enabled || !"POST".equalsIgnoreCase(request.getMethod())) {
            return true;
        }

        ClientRateLimiter.Decision decision = limiter.acquire(request.getRemoteAddr());
        if (decision.allowed()) {
            return true;
        }

        response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
        response.setHeader("Retry-After", Long.toString(decision.retryAfterSeconds()));
        response.setContentType(MediaType.APPLICATION_PROBLEM_JSON_VALUE);
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(
                HttpStatus.TOO_MANY_REQUESTS, "Too many ReelSave requests. Please wait and try again.");
        problem.setTitle("Too many requests");
        problem.setProperty("retryAfterSeconds", decision.retryAfterSeconds());
        objectMapper.writeValue(response.getOutputStream(), problem);
        return false;
    }
}
