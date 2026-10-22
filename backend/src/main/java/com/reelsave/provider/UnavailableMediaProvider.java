package com.reelsave.provider;

import com.reelsave.domain.MediaResult;
import com.reelsave.domain.ReelUrl;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(name = "media.provider", havingValue = "unavailable", matchIfMissing = true)
public class UnavailableMediaProvider implements MediaProvider {

    @Override
    public MediaResult resolve(ReelUrl reelUrl) {
        return MediaResult.unavailable();
    }
}
