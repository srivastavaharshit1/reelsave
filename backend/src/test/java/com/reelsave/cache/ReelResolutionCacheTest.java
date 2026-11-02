package com.reelsave.cache;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.reelsave.domain.MediaResult;
import com.reelsave.domain.MediaStatus;
import java.net.URI;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class ReelResolutionCacheTest {

    private ReelResolutionCache cache;

    @BeforeEach
    void setUp() {
        cache = new ReelResolutionCache(3, 300);
    }

    @Test
    void cachesSuccessfulReadyResult() {
        MediaResult ready = new MediaResult(
                MediaStatus.READY,
                URI.create("https://scontent.cdninstagram.com/reel.mp4"),
                "shortcode1",
                "reel.mp4",
                "video/mp4",
                1024L,
                null,
                null);

        cache.put("shortcode1", ready);

        Optional<MediaResult> retrieved = cache.get("shortcode1");
        assertTrue(retrieved.isPresent());
        assertEquals(ready.mediaUrl(), retrieved.get().mediaUrl());
    }

    @Test
    void doesNotCacheNonReadyOrEmptyUrlResults() {
        MediaResult unavailable = MediaResult.unavailable();
        cache.put("shortcode2", unavailable);
        assertFalse(cache.get("shortcode2").isPresent());

        MediaResult readyNoUrl = new MediaResult(
                MediaStatus.READY, null, "shortcode3", "reel.mp4", "video/mp4", null, null, null);
        cache.put("shortcode3", readyNoUrl);
        assertFalse(cache.get("shortcode3").isPresent());
    }

    @Test
    void enforcesCapacityBoundaryViaLruEviction() {
        MediaResult result1 = new MediaResult(MediaStatus.READY, URI.create("https://scontent.cdninstagram.com/1.mp4"), "1", null, null, null, null, null);
        MediaResult result2 = new MediaResult(MediaStatus.READY, URI.create("https://scontent.cdninstagram.com/2.mp4"), "2", null, null, null, null, null);
        MediaResult result3 = new MediaResult(MediaStatus.READY, URI.create("https://scontent.cdninstagram.com/3.mp4"), "3", null, null, null, null, null);
        MediaResult result4 = new MediaResult(MediaStatus.READY, URI.create("https://scontent.cdninstagram.com/4.mp4"), "4", null, null, null, null, null);

        cache.put("1", result1);
        cache.put("2", result2);
        cache.put("3", result3);
        // Exceed capacity 3
        cache.put("4", result4);

        // "1" was eldest, should be evicted
        assertFalse(cache.get("1").isPresent());
        assertTrue(cache.get("2").isPresent());
        assertTrue(cache.get("3").isPresent());
        assertTrue(cache.get("4").isPresent());
        assertEquals(3, cache.size());
    }

    @Test
    void expiresEntriesAfterTtl() throws InterruptedException {
        ReelResolutionCache shortLivedCache = new ReelResolutionCache(10, 1);
        MediaResult result = new MediaResult(
                MediaStatus.READY,
                URI.create("https://scontent.cdninstagram.com/ttl.mp4"),
                "ttl",
                null,
                null,
                null,
                null,
                null);

        shortLivedCache.put("ttl", result);
        assertTrue(shortLivedCache.get("ttl").isPresent());

        Thread.sleep(1100);
        assertFalse(shortLivedCache.get("ttl").isPresent());
    }

    @Test
    void evictsOnExplicitCallAndClear() {
        MediaResult result = new MediaResult(MediaStatus.READY, URI.create("https://scontent.cdninstagram.com/1.mp4"), "1", null, null, null, null, null);
        cache.put("1", result);
        assertTrue(cache.get("1").isPresent());

        cache.evict("1");
        assertFalse(cache.get("1").isPresent());

        cache.put("1", result);
        cache.clear();
        assertEquals(0, cache.size());
    }
}

