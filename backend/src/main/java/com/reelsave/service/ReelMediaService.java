package com.reelsave.service;

import com.reelsave.domain.MediaResult;
import com.reelsave.domain.ReelUrl;
import com.reelsave.provider.MediaProvider;
import org.springframework.stereotype.Service;

@Service
public class ReelMediaService {

    private final MediaProvider mediaProvider;

    public ReelMediaService(MediaProvider mediaProvider) {
        this.mediaProvider = mediaProvider;
    }

    public MediaResult resolve(ReelUrl reelUrl) {
        return mediaProvider.resolve(reelUrl);
    }
}
