package com.reelsave.security;

import java.time.Duration;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.function.LongSupplier;

/** A bounded, process-local fixed-window limiter keyed by the servlet remote address. */
public final class ClientRateLimiter {

    private final int requestsPerWindow;
    private final long windowNanos;
    private final int maximumClients;
    private final LongSupplier nanoTime;
    private final LinkedHashMap<String, Window> windows = new LinkedHashMap<>();

    public ClientRateLimiter(int requestsPerWindow, Duration window, int maximumClients) {
        this(requestsPerWindow, window, maximumClients, System::nanoTime);
    }

    ClientRateLimiter(int requestsPerWindow, Duration window, int maximumClients, LongSupplier nanoTime) {
        if (requestsPerWindow < 1 || requestsPerWindow > 100_000
                || window == null || window.isZero() || window.isNegative()
                || window.compareTo(Duration.ofHours(1)) > 0
                || maximumClients < 1 || maximumClients > 100_000 || nanoTime == null) {
            throw new IllegalArgumentException("Rate limit settings are outside the allowed range.");
        }
        this.requestsPerWindow = requestsPerWindow;
        this.windowNanos = window.toNanos();
        this.maximumClients = maximumClients;
        this.nanoTime = nanoTime;
    }

    public synchronized Decision acquire(String remoteAddress) {
        long now = nanoTime.getAsLong();
        String client = remoteAddress == null || remoteAddress.isBlank() ? "unknown" : remoteAddress;
        Window current = windows.get(client);

        if (current != null && isExpired(current, now)) {
            windows.remove(client);
            current = null;
        }

        if (current == null) {
            removeExpiredOldest(now);
            if (windows.size() >= maximumClients) {
                Window oldest = windows.values().iterator().next();
                return denied(retryAfterSeconds(oldest, now));
            }
            windows.put(client, new Window(now, 1));
            return allowed();
        }

        if (current.requestCount() >= requestsPerWindow) {
            return denied(retryAfterSeconds(current, now));
        }
        windows.put(client, new Window(current.windowStartedAtNanos(), current.requestCount() + 1));
        return allowed();
    }

    private void removeExpiredOldest(long now) {
        Iterator<Map.Entry<String, Window>> entries = windows.entrySet().iterator();
        while (entries.hasNext() && isExpired(entries.next().getValue(), now)) {
            entries.remove();
        }
    }

    private boolean isExpired(Window window, long now) {
        return now - window.windowStartedAtNanos() >= windowNanos;
    }

    private long retryAfterSeconds(Window window, long now) {
        long remaining = Math.max(1, windowNanos - (now - window.windowStartedAtNanos()));
        return Math.max(1, (remaining + 999_999_999L) / 1_000_000_000L);
    }

    private static Decision allowed() {
        return new Decision(true, 0);
    }

    private static Decision denied(long retryAfterSeconds) {
        return new Decision(false, retryAfterSeconds);
    }

    public record Decision(boolean allowed, long retryAfterSeconds) {
    }

    private record Window(long windowStartedAtNanos, int requestCount) {
    }
}
