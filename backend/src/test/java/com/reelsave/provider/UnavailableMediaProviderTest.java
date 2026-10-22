package com.reelsave.provider;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import com.reelsave.domain.MediaResult;
import com.reelsave.domain.MediaStatus;
import com.reelsave.domain.ReelUrl;
import org.junit.jupiter.api.Test;

class UnavailableMediaProviderTest {

    private final UnavailableMediaProvider provider = new UnavailableMediaProvider();

    @Test
    void returnsUnavailableWithoutMediaLocation() {
        MediaResult result = provider.resolve(validReelUrl());

        assertEquals(MediaStatus.UNAVAILABLE, result.status());
        assertEquals("Media download is not currently available.", result.message());
        assertNull(result.mediaUrl());
        assertNull(result.providerReference());
    }

    @Test
    void isStatelessAndDoesNotDependOnAnOutboundHttpClient() {
        // The placeholder has no injected HTTP client or other network dependency.
        assertEquals(0, UnavailableMediaProvider.class.getDeclaredFields().length);
    }

    private ReelUrl validReelUrl() {
        return ReelUrl.parse("https://www.instagram.com/reel/ABC123/").orElseThrow();
    }
}
