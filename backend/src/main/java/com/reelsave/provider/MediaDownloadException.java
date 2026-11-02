package com.reelsave.provider;

import com.reelsave.domain.MediaStatus;

public class MediaDownloadException extends Exception {

    private static final long serialVersionUID = 1L;

    private final MediaStatus status;

    public MediaDownloadException(MediaStatus status, String safeMessage) {
        super(safeMessage);
        this.status = status;
    }

    public MediaStatus status() {
        return status;
    }
}
