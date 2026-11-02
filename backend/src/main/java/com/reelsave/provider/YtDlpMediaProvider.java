package com.reelsave.provider;

import com.reelsave.domain.MediaResult;
import com.reelsave.domain.MediaStatus;
import com.reelsave.domain.ReelUrl;
import java.io.IOException;
import java.net.URI;
import java.net.URISyntaxException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.concurrent.Semaphore;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(name = "media.provider", havingValue = "ytdlp")
public class YtDlpMediaProvider implements MediaDownloadProvider {

    private static final Logger logger = LoggerFactory.getLogger(YtDlpMediaProvider.class);

    private static final int MAX_HEIGHT = 1080;
    private static final long HARD_MAX_DOWNLOAD_BYTES = 50L * 1024 * 1024;
    private static final String PROGRESSIVE_MP4_FORMAT = "best[ext=mp4][height<=1080]/best[ext=mp4]";
    private static final String SAFE_FAILURE_MESSAGE = "Media could not be resolved.";
    private static final int MAX_CONCURRENT_RESOLVES = 4;
    private static final int MAX_CONCURRENT_DOWNLOADS = 2;
    private static final List<String> FIXED_ARGUMENTS = List.of(
            "--ignore-config",
            "--no-cookies",
            "--no-cookies-from-browser",
            "--no-cache-dir",
            "--no-playlist",
            "--format",
            PROGRESSIVE_MP4_FORMAT,
            "--simulate",
            "--dump-single-json",
            "--retries",
            "0",
            "--extractor-retries",
            "0");

    private final JsonMapper objectMapper;
    private final YtDlpProcessRunner processRunner;
    private final String executable;
    private final Duration timeout;
    private final Duration downloadTimeout;
    private final long maximumDownloadBytes;
    private final Semaphore resolvePermits = new Semaphore(MAX_CONCURRENT_RESOLVES);
    private final Semaphore downloadPermits = new Semaphore(MAX_CONCURRENT_DOWNLOADS);

    public YtDlpMediaProvider(
            JsonMapper objectMapper,
            YtDlpProcessRunner processRunner,
            @Value("${media.ytdlp.executable:yt-dlp}") String executable,
            @Value("${media.ytdlp.timeout-seconds:30}") long timeoutSeconds,
            @Value("${media.ytdlp.download-timeout-seconds:120}") long downloadTimeoutSeconds,
            @Value("${media.ytdlp.maximum-download-bytes:52428800}") long maximumDownloadBytes) {
        if (executable == null || executable.isBlank()) {
            throw new IllegalArgumentException("yt-dlp executable must be configured.");
        }
        if (timeoutSeconds <= 0 || timeoutSeconds > 300 || downloadTimeoutSeconds <= 0 || downloadTimeoutSeconds > 300) {
            throw new IllegalArgumentException("yt-dlp timeouts must be between 1 and 300 seconds.");
        }
        if (maximumDownloadBytes <= 0 || maximumDownloadBytes > HARD_MAX_DOWNLOAD_BYTES) {
            throw new IllegalArgumentException("yt-dlp maximum download size must be between 1 and 52428800 bytes.");
        }
        this.objectMapper = objectMapper;
        this.processRunner = processRunner;
        this.executable = executable;
        this.timeout = Duration.ofSeconds(timeoutSeconds);
        this.downloadTimeout = Duration.ofSeconds(downloadTimeoutSeconds);
        this.maximumDownloadBytes = maximumDownloadBytes;
    }

    @Override
    public MediaResult resolve(ReelUrl reelUrl) {
        if (!resolvePermits.tryAcquire()) {
            return new MediaResult(
                    MediaStatus.UNAVAILABLE, null, null, null, null, null, null,
                    "Media resolution is busy. Please try again shortly.");
        }

        try {
            return resolveWithPermit(reelUrl);
        } finally {
            resolvePermits.release();
        }
    }

    private MediaResult resolveWithPermit(ReelUrl reelUrl) {
        List<String> arguments = new ArrayList<>(FIXED_ARGUMENTS);
        arguments.add(reelUrl.uri().toString());

        try {
            YtDlpProcessRunner.ExecutionResult result = processRunner.execute(executable, arguments, timeout);
            if (result.exitCode() != 0 || result.stdoutTruncated() || result.stderrTruncated()) {
                logger.warn("yt-dlp metadata resolution failed; exitCode={}, outputTruncated={}",
                        result.exitCode(), result.stdoutTruncated() || result.stderrTruncated());
                return error(SAFE_FAILURE_MESSAGE);
            }

            JsonNode metadata = objectMapper.readTree(result.stdout());
            if (metadata == null || !metadata.isObject()) {
                return error(SAFE_FAILURE_MESSAGE);
            }

            Optional<SelectedFormat> selectedFormat = selectFormat(metadata);
            if (selectedFormat.isEmpty()) {
                return error(SAFE_FAILURE_MESSAGE);
            }

            String shortcode = shortcode(reelUrl);
            return new MediaResult(
                    MediaStatus.READY,
                    selectedFormat.get().url(),
                    shortcode,
                    "reel-" + shortcode + ".mp4",
                    "video/mp4",
                    selectedFormat.get().fileSizeBytes(),
                    null,
                    null);
        } catch (JacksonException exception) {
            logger.warn("yt-dlp returned invalid metadata JSON.");
            return error(SAFE_FAILURE_MESSAGE);
        } catch (YtDlpProcessRunner.ProcessTimedOutException exception) {
            logger.warn("yt-dlp metadata resolution timed out.");
            return error("Media resolution timed out.");
        } catch (YtDlpProcessRunner.OutputLimitExceededException exception) {
            logger.warn("yt-dlp metadata output exceeded its configured limit.");
            return error(SAFE_FAILURE_MESSAGE);
        } catch (IOException exception) {
            logger.warn("Unable to launch or read the yt-dlp metadata process: {}", exception.getClass().getSimpleName());
            return error(SAFE_FAILURE_MESSAGE);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            logger.warn("yt-dlp metadata resolution was interrupted.");
            return error("Media resolution was interrupted.");
        }
    }

    @Override
    public DownloadedMedia download(ReelUrl reelUrl) throws MediaDownloadException {
        if (!downloadPermits.tryAcquire()) {
            throw new MediaDownloadException(MediaStatus.UNAVAILABLE, "Downloads are busy. Please try again shortly.");
        }

        Path directory = null;
        boolean handedOff = false;
        try {
            directory = Files.createTempDirectory("reelsave-download-");
            String filename = "reelsave-" + shortcode(reelUrl) + ".mp4";
            Path output = directory.resolve(filename);
            List<String> arguments = List.of(
                    "--ignore-config",
                    "--no-cookies",
                    "--no-cookies-from-browser",
                    "--no-cache-dir",
                    "--no-playlist",
                    "--no-progress",
                    "--no-part",
                    "--format", PROGRESSIVE_MP4_FORMAT,
                    "--max-filesize", Long.toString(maximumDownloadBytes),
                    "--output", output.toString(),
                    "--retries", "0",
                    "--extractor-retries", "0",
                    "--fragment-retries", "0",
                    reelUrl.uri().toString());
            YtDlpProcessRunner.ExecutionResult result = processRunner.execute(
                    executable, arguments, downloadTimeout, output, maximumDownloadBytes);
            if (result.exitCode() != 0 || result.stdoutTruncated() || result.stderrTruncated()) {
                logger.warn("yt-dlp media download failed; exitCode={}, outputTruncated={}",
                        result.exitCode(), result.stdoutTruncated() || result.stderrTruncated());
                throw new MediaDownloadException(MediaStatus.ERROR, "Media could not be downloaded.");
            }

            if (!Files.isRegularFile(output)) {
                throw new MediaDownloadException(MediaStatus.ERROR, "Media could not be downloaded.");
            }
            long sizeBytes = Files.size(output);
            if (sizeBytes <= 0) {
                throw new MediaDownloadException(MediaStatus.ERROR, "Media could not be downloaded.");
            }
            if (sizeBytes > maximumDownloadBytes) {
                throw new MediaDownloadException(MediaStatus.ERROR, "This video exceeds the download size limit.");
            }
            Mp4Inspector.Inspection inspection = Mp4Inspector.inspect(output);
            if (!inspection.isMp4()) {
                throw new MediaDownloadException(MediaStatus.ERROR, "The provider did not return a valid MP4 file.");
            }
            if (!inspection.hasVideo() || !inspection.hasAudio()) {
                throw new MediaDownloadException(
                        MediaStatus.ERROR, "The selected MP4 did not contain both video and audio streams.");
            }

            DownloadedMedia downloadedMedia = new DownloadedMedia(
                    directory, output, filename, sizeBytes, downloadPermits::release);
            handedOff = true;
            return downloadedMedia;
        } catch (YtDlpProcessRunner.ProcessTimedOutException exception) {
            logger.warn("yt-dlp media download timed out.");
            throw new MediaDownloadException(MediaStatus.ERROR, "Media download timed out.");
        } catch (YtDlpProcessRunner.OutputLimitExceededException exception) {
            logger.warn("yt-dlp media download exceeded its configured size limit.");
            throw new MediaDownloadException(MediaStatus.ERROR, "This video exceeds the download size limit.");
        } catch (IOException exception) {
            logger.warn("Unable to launch or read the yt-dlp download process: {}", exception.getClass().getSimpleName());
            throw new MediaDownloadException(MediaStatus.ERROR, "Media could not be downloaded.");
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            logger.warn("yt-dlp media download was interrupted.");
            throw new MediaDownloadException(MediaStatus.ERROR, "Media download was interrupted.");
        } finally {
            if (!handedOff) {
                deleteTemporaryDirectory(directory);
                downloadPermits.release();
            }
        }
    }

    private Optional<SelectedFormat> selectFormat(JsonNode metadata) {
        return toSelectedFormat(metadata);
    }

    private Optional<SelectedFormat> toSelectedFormat(JsonNode format) {
        if (!"mp4".equalsIgnoreCase(format.path("ext").asString())) {
            return Optional.empty();
        }
        String videoExt = format.path("video_ext").asString("");
        if ("none".equalsIgnoreCase(videoExt)) {
            return Optional.empty();
        }

        JsonNode heightNode = format.path("height");
        int height = heightNode.canConvertToInt() ? heightNode.asInt() : 0;
        if (heightNode.canConvertToInt() && (height <= 0 || height > MAX_HEIGHT)) {
            return Optional.empty();
        }

        JsonNode requestedFormats = format.path("requested_formats");
        if (requestedFormats.isArray() && requestedFormats.size() != 1) {
            return Optional.empty();
        }
        if (format.path("format_id").asString("").contains("+")) {
            return Optional.empty();
        }

        URI url = allowedMediaUrl(format.path("url").asString());
        if (url == null) {
            return Optional.empty();
        }

        String videoCodec = format.path("vcodec").asString("");
        if ("none".equalsIgnoreCase(videoCodec)) {
            return Optional.empty();
        }
        String audioCodec = format.path("acodec").asString("");
        if ("none".equalsIgnoreCase(audioCodec)) {
            return Optional.empty();
        }
        Long fileSizeBytes = positiveLong(format.path("filesize"));
        if (fileSizeBytes == null) {
            fileSizeBytes = positiveLong(format.path("filesize_approx"));
        }
        return Optional.of(new SelectedFormat(url, fileSizeBytes));
    }

    private static void deleteTemporaryDirectory(Path directory) {
        if (directory == null) {
            return;
        }
        try (var files = Files.walk(directory)) {
            files.sorted(java.util.Comparator.reverseOrder()).forEach(path -> {
                try {
                    Files.deleteIfExists(path);
                } catch (IOException exception) {
                    // Cleanup is best effort; the directory is outside the repository.
                }
            });
        } catch (IOException exception) {
            // Cleanup is best effort; the directory is outside the repository.
        }
    }

    private static URI allowedMediaUrl(String rawUrl) {
        if (rawUrl == null || rawUrl.isBlank() || rawUrl.length() > 8192) {
            return null;
        }
        try {
            URI uri = new URI(rawUrl);
            String host = uri.getHost();
            if (!uri.isAbsolute()
                    || uri.getScheme() == null
                    || !"https".equalsIgnoreCase(uri.getScheme())
                    || uri.getRawUserInfo() != null
                    || uri.getRawFragment() != null
                    || (uri.getPort() != -1 && uri.getPort() != 443)
                    || host == null
                    || !host.toLowerCase(Locale.ROOT).endsWith(".cdninstagram.com")
                    || uri.getRawPath() == null
                    || uri.getRawPath().isBlank()) {
                return null;
            }
            return uri;
        } catch (URISyntaxException | IllegalArgumentException exception) {
            return null;
        }
    }

    private static Long positiveLong(JsonNode value) {
        if (!value.canConvertToLong()) {
            return null;
        }
        long parsed = value.asLong();
        return parsed > 0 ? parsed : null;
    }

    private static String shortcode(ReelUrl reelUrl) {
        String path = reelUrl.uri().getPath();
        String value = path.substring("/reel/".length());
        return value.endsWith("/") ? value.substring(0, value.length() - 1) : value;
    }

    private static MediaResult error(String message) {
        return new MediaResult(MediaStatus.ERROR, null, null, null, null, null, null, message);
    }

    private record SelectedFormat(URI url, Long fileSizeBytes) {
    }
}
