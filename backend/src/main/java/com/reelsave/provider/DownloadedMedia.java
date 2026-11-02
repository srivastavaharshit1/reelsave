package com.reelsave.provider;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.concurrent.atomic.AtomicBoolean;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/** A bounded temporary file whose lifetime ends when the HTTP response finishes. */
public final class DownloadedMedia implements AutoCloseable {

    private static final Logger logger = LoggerFactory.getLogger(DownloadedMedia.class);

    private final Path directory;
    private final Path file;
    private final String filename;
    private final long sizeBytes;
    private final Runnable onClose;
    private final AtomicBoolean closed = new AtomicBoolean();

    public DownloadedMedia(Path directory, Path file, String filename, long sizeBytes, Runnable onClose) {
        this.directory = directory;
        this.file = file;
        this.filename = filename;
        this.sizeBytes = sizeBytes;
        this.onClose = onClose;
    }

    public Path file() {
        return file;
    }

    public String filename() {
        return filename;
    }

    public long sizeBytes() {
        return sizeBytes;
    }

    @Override
    public void close() {
        if (!closed.compareAndSet(false, true)) {
            return;
        }
        try (var paths = Files.walk(directory)) {
            for (Path path : paths.sorted(java.util.Comparator.reverseOrder()).toList()) {
                try {
                    Files.deleteIfExists(path);
                } catch (IOException exception) {
                    logger.warn("Unable to remove a temporary media download file.");
                }
            }
        } catch (IOException exception) {
            logger.warn("Unable to inspect a temporary media download directory.");
        } finally {
            onClose.run();
        }
    }
}
