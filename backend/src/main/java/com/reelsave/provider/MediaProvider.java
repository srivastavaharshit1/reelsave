package com.reelsave.provider;

import com.reelsave.domain.MediaResult;
import com.reelsave.domain.ReelUrl;

public interface MediaProvider {

    MediaResult resolve(ReelUrl reelUrl);
}
