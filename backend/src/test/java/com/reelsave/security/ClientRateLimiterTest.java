package com.reelsave.security;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Duration;
import java.util.concurrent.atomic.AtomicLong;
import org.junit.jupiter.api.Test;

class ClientRateLimiterTest {

    @Test
    void enforcesWindowAndAllowsRequestsAfterExpiry() {
        AtomicLong clock = new AtomicLong(1_000_000_000L);
        ClientRateLimiter limiter = new ClientRateLimiter(2, Duration.ofSeconds(60), 10, clock::get);

        assertTrue(limiter.acquire("192.0.2.1").allowed());
        assertTrue(limiter.acquire("192.0.2.1").allowed());
        ClientRateLimiter.Decision limited = limiter.acquire("192.0.2.1");
        assertFalse(limited.allowed());
        assertTrue(limited.retryAfterSeconds() > 0);

        clock.addAndGet(Duration.ofSeconds(60).toNanos());
        assertTrue(limiter.acquire("192.0.2.1").allowed());
    }

    @Test
    void boundsTrackedClientsAndReusesSlotsAfterExpiry() {
        AtomicLong clock = new AtomicLong(1_000_000_000L);
        ClientRateLimiter limiter = new ClientRateLimiter(2, Duration.ofSeconds(10), 1, clock::get);

        assertTrue(limiter.acquire("192.0.2.1").allowed());
        assertFalse(limiter.acquire("192.0.2.2").allowed());

        clock.addAndGet(Duration.ofSeconds(10).toNanos());
        assertTrue(limiter.acquire("192.0.2.2").allowed());
    }
}
