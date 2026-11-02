package com.reelsave.cache;

import com.reelsave.domain.MediaResult;
import com.reelsave.domain.MediaStatus;
import java.time.Duration;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.locks.ReentrantReadWriteLock;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Thread-safe, bounded, short-lived cache for resolved Reel metadata.
 * Uses normalized Reel shortcode as key and enforces both an entry limit (LRU)
 * and a time-to-live limit so expired CDN URLs are never served.
 */
@Component
public class ReelResolutionCache {

    private static final Logger logger = LoggerFactory.getLogger(ReelResolutionCache.class);

    private final int maxEntries;
    private final Duration ttl;
    private final ReentrantReadWriteLock lock = new ReentrantReadWriteLock();
    private final Map<String, CacheEntry> entries;

    public ReelResolutionCache(
            @Value("${media.cache.max-entries:500}") int maxEntries,
            @Value("${media.cache.ttl-seconds:300}") long ttlSeconds) {
        if (maxEntries <= 0 || maxEntries > 100_000) {
            throw new IllegalArgumentException("Cache max-entries must be between 1 and 100,000.");
        }
        if (ttlSeconds <= 0 || ttlSeconds > 3600) {
            throw new IllegalArgumentException("Cache TTL must be between 1 and 3600 seconds.");
        }
        this.maxEntries = maxEntries;
        this.ttl = Duration.ofSeconds(ttlSeconds);
        this.entries = new LinkedHashMap<>(maxEntries, 0.75f, true) {
            @Override
            protected boolean removeEldestEntry(Map.Entry<String, CacheEntry> eldest) {
                return size() > ReelResolutionCache.this.maxEntries;
            }
        };
    }

    public Optional<MediaResult> get(String shortcode) {
        if (shortcode == null || shortcode.isBlank()) {
            return Optional.empty();
        }
        lock.readLock().lock();
        try {
            CacheEntry entry = entries.get(shortcode);
            if (entry == null) {
                return Optional.empty();
            }
            if (entry.isExpired()) {
                // Expired entry found; clean up asynchronously or during next write
                return Optional.empty();
            }
            return Optional.of(entry.result());
        } finally {
            lock.readLock().unlock();
        }
    }

    public void put(String shortcode, MediaResult result) {
        if (shortcode == null || shortcode.isBlank() || result == null) {
            return;
        }
        // Only cache successful READY results with valid media URLs
        if (result.status() != MediaStatus.READY || result.mediaUrl() == null) {
            return;
        }

        Instant now = Instant.now();
        Instant expiresAt = now.plus(ttl);
        CacheEntry entry = new CacheEntry(result, now, expiresAt);

        lock.writeLock().lock();
        try {
            entries.put(shortcode, entry);
        } finally {
            lock.writeLock().unlock();
        }
    }

    public void evict(String shortcode) {
        if (shortcode == null) return;
        lock.writeLock().lock();
        try {
            entries.remove(shortcode);
        } finally {
            lock.writeLock().unlock();
        }
    }

    public int size() {
        lock.readLock().lock();
        try {
            return entries.size();
        } finally {
            lock.readLock().unlock();
        }
    }

    public void clear() {
        lock.writeLock().lock();
        try {
            entries.clear();
        } finally {
            lock.writeLock().unlock();
        }
    }

    public record CacheEntry(MediaResult result, Instant cachedAt, Instant expiresAt) {
        public boolean isExpired() {
            return Instant.now().isAfter(expiresAt);
        }
    }
}
