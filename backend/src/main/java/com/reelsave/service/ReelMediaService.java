package com.reelsave.service;

import com.reelsave.cache.ReelResolutionCache;
import com.reelsave.domain.MediaResult;
import com.reelsave.domain.MediaStatus;
import com.reelsave.domain.ReelUrl;
import com.reelsave.provider.MediaProvider;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

@Service
public class ReelMediaService {

    private static final Logger logger = LoggerFactory.getLogger(ReelMediaService.class);

    private final MediaProvider mediaProvider;
    private final ReelResolutionCache cache;
    private final ConcurrentHashMap<String, CompletableFuture<MediaResult>> inFlight = new ConcurrentHashMap<>();

    public ReelMediaService(MediaProvider mediaProvider) {
        this(mediaProvider, new ReelResolutionCache(500, 300));
    }

    @org.springframework.beans.factory.annotation.Autowired
    public ReelMediaService(MediaProvider mediaProvider, ReelResolutionCache cache) {
        this.mediaProvider = mediaProvider;
        this.cache = cache != null ? cache : new ReelResolutionCache(500, 300);
    }

    public ResolutionOutcome resolveWithOutcome(ReelUrl reelUrl) {
        String shortcode = extractShortcode(reelUrl);

        // 1. Check bounded short-lived cache
        Optional<MediaResult> cached = cache.get(shortcode);
        if (cached.isPresent()) {
            logger.info("Cache HIT for shortcode={}", shortcode);
            return new ResolutionOutcome(cached.get(), true, false);
        }

        // 2. Coalesce duplicate in-flight requests for the same shortcode
        final boolean[] isLeader = new boolean[] { false };
        CompletableFuture<MediaResult> future = inFlight.compute(shortcode, (key, existing) -> {
            if (existing != null) {
                return existing;
            }
            isLeader[0] = true;
            return CompletableFuture.supplyAsync(() -> {
                try {
                    MediaResult result = mediaProvider.resolve(reelUrl);
                    if (result.status() == MediaStatus.READY) {
                        cache.put(key, result);
                    }
                    return result;
                } finally {
                    inFlight.remove(key);
                }
            });
        });

        try {
            MediaResult result = future.join();
            return new ResolutionOutcome(result, false, !isLeader[0]);
        } catch (Exception e) {
            inFlight.remove(shortcode);
            logger.warn("In-flight resolution failed for shortcode={}: {}", shortcode, e.getMessage());
            return new ResolutionOutcome(
                    new MediaResult(MediaStatus.ERROR, null, null, null, null, null, null, "Media could not be resolved."),
                    false, !isLeader[0]);
        }
    }

    public MediaResult resolve(ReelUrl reelUrl) {
        return resolveWithOutcome(reelUrl).result();
    }

    public ReelResolutionCache cache() {
        return cache;
    }

    public record ResolutionOutcome(MediaResult result, boolean cacheHit, boolean coalesced) {}

    private static String extractShortcode(ReelUrl reelUrl) {
        String path = reelUrl.uri().getPath();
        String value = path.substring("/reel/".length());
        return value.endsWith("/") ? value.substring(0, value.length() - 1) : value;
    }
}
