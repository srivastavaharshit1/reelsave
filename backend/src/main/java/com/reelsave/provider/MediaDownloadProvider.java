package com.reelsave.provider;

import com.reelsave.domain.ReelUrl;

/** Optional download capability implemented by providers that can produce a temporary media file. */
public interface MediaDownloadProvider extends MediaProvider {

    DownloadedMedia download(ReelUrl reelUrl) throws MediaDownloadException;
}
