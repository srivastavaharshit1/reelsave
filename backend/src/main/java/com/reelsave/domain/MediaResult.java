package com.reelsave.domain;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.net.URI;
import java.time.Instant;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record MediaResult(
        MediaStatus status,
        URI mediaUrl,
        String providerReference,
        String filename,
        String contentType,
        Long fileSizeBytes,
        Instant expiresAt,
        String message) {

    public static MediaResult unavailable() {
        return new MediaResult(
                MediaStatus.UNAVAILABLE,
                null,
                null,
                null,
                null,
                null,
                null,
                "Media download is not currently available.");
    }
}
