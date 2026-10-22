package com.reelsave.service;

import static org.junit.jupiter.api.Assertions.assertSame;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.reelsave.domain.MediaResult;
import com.reelsave.domain.ReelUrl;
import com.reelsave.provider.MediaProvider;
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
}
