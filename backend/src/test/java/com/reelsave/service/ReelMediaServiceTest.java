package com.reelsave.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.reelsave.cache.ReelResolutionCache;
import com.reelsave.domain.MediaResult;
import com.reelsave.domain.MediaStatus;
import com.reelsave.domain.ReelUrl;
import com.reelsave.provider.MediaProvider;
import java.net.URI;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.Test;

class ReelMediaServiceTest {

    @Test
    void delegatesResolutionToConfiguredProvider() {
        MediaProvider provider = mock(MediaProvider.class);
        ReelMediaService service = new ReelMediaService(provider);
        ReelUrl reelUrl = ReelUrl.parse("https://www.instagram.com/reel/ABC123/").orElseThrow();
        MediaResult expected = MediaResult.unavailable();
        when(provider.resolve(reelUrl)).thenReturn(expected);

        MediaResult actual = service.resolve(reelUrl);

        assertSame(expected, actual);
        verify(provider).resolve(reelUrl);
    }

    @Test
    void returnsCachedResultOnRepeatedResolutionWithoutCallingProviderAgain() {
        MediaProvider provider = mock(MediaProvider.class);
        ReelResolutionCache cache = new ReelResolutionCache(10, 300);
        ReelMediaService service = new ReelMediaService(provider, cache);
        ReelUrl reelUrl = ReelUrl.parse("https://www.instagram.com/reel/XYZ789/").orElseThrow();

        MediaResult ready = new MediaResult(
                MediaStatus.READY,
                URI.create("https://scontent.cdninstagram.com/video.mp4"),
                "XYZ789",
                "reel-XYZ789.mp4",
                "video/mp4",
                5000L,
                null,
                null);
        when(provider.resolve(reelUrl)).thenReturn(ready);

        // 1st call -> provider invoked, cached
        ReelMediaService.ResolutionOutcome outcome1 = service.resolveWithOutcome(reelUrl);
        assertEquals(ready, outcome1.result());
        org.junit.jupiter.api.Assertions.assertFalse(outcome1.cacheHit());

        // 2nd call -> served from cache
        ReelMediaService.ResolutionOutcome outcome2 = service.resolveWithOutcome(reelUrl);
        assertEquals(ready, outcome2.result());
        assertTrue(outcome2.cacheHit());

        // Provider should only be called once
        verify(provider, times(1)).resolve(reelUrl);
    }

    @Test
    void coalescesConcurrentResolutionsForSameReel() throws Exception {
        MediaProvider provider = mock(MediaProvider.class);
        ReelResolutionCache cache = new ReelResolutionCache(10, 300);
        ReelMediaService service = new ReelMediaService(provider, cache);
        ReelUrl reelUrl = ReelUrl.parse("https://www.instagram.com/reel/COALESCE1/").orElseThrow();

        MediaResult ready = new MediaResult(
                MediaStatus.READY,
                URI.create("https://scontent.cdninstagram.com/coalesce.mp4"),
                "COALESCE1",
                "reel-COALESCE1.mp4",
                "video/mp4",
                2000L,
                null,
                null);

        CountDownLatch gate = new CountDownLatch(1);
        when(provider.resolve(reelUrl)).thenAnswer(inv -> {
            gate.await(2, TimeUnit.SECONDS);
            return ready;
        });

        ExecutorService executor = Executors.newFixedThreadPool(2);
        try {
            Future<ReelMediaService.ResolutionOutcome> future1 = executor.submit(() -> service.resolveWithOutcome(reelUrl));
            Thread.sleep(50);
            Future<ReelMediaService.ResolutionOutcome> future2 = executor.submit(() -> service.resolveWithOutcome(reelUrl));

            gate.countDown();

            ReelMediaService.ResolutionOutcome res1 = future1.get(3, TimeUnit.SECONDS);
            ReelMediaService.ResolutionOutcome res2 = future2.get(3, TimeUnit.SECONDS);

            assertEquals(ready, res1.result());
            assertEquals(ready, res2.result());

            // Exactly one call to provider despite two concurrent requests
            verify(provider, times(1)).resolve(reelUrl);
        } finally {
            executor.shutdownNow();
        }
    }
}
