package com.reelsave.provider;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.reelsave.domain.MediaResult;
import com.reelsave.domain.MediaStatus;
import com.reelsave.domain.ReelUrl;
import java.net.URI;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import tools.jackson.databind.json.JsonMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class YtDlpMediaProviderTest {

    private static final String EXECUTABLE = "yt-dlp-test-executable";
    private static final String REEL = "https://www.instagram.com/reel/ABC123/";
    private static final String VALID_CDN_URL = "https://scontent.example.cdninstagram.com/video.mp4";
    private static final Duration TIMEOUT = Duration.ofSeconds(2);

    private final YtDlpProcessRunner processRunner = mock(YtDlpProcessRunner.class);
    private final YtDlpMediaProvider provider = new YtDlpMediaProvider(
            JsonMapper.builder().build(), processRunner, EXECUTABLE, TIMEOUT.toSeconds(), TIMEOUT.toSeconds(),
            50L * 1024 * 1024);

    @BeforeEach
    void resetProcessRunner() {
        org.mockito.Mockito.reset(processRunner);
    }

    @Test
    void returnsReadyForYtDlpSelectedProgressiveMp4AndUsesOnlyFixedArguments() throws Exception {
        stubSuccess("{\"format_id\":\"3\",\"ext\":\"mp4\",\"url\":\"" + VALID_CDN_URL + "\"}");

        MediaResult result = provider.resolve(validReelUrl());

        assertEquals(MediaStatus.READY, result.status());
        assertEquals(URI.create(VALID_CDN_URL), result.mediaUrl());
        assertEquals("ABC123", result.providerReference());
        assertEquals("video/mp4", result.contentType());
        verify(processRunner).execute(eq(EXECUTABLE), eq(List.of(
                "--ignore-config",
                "--no-cookies",
                "--no-cookies-from-browser",
                "--no-cache-dir",
                "--no-playlist",
                "--no-write-comments",
                "--no-check-formats",
                "--format",
                "best[ext=mp4][height<=1080]/best[ext=mp4]",
                "--simulate",
                "--dump-single-json",
                "--retries",
                "0",
                "--extractor-retries",
                "0",
                REEL)), eq(TIMEOUT));
    }

    @Test
    void limitsConcurrentMetadataProcessesAndReturnsUnavailableWhenBusy() throws Exception {
        CountDownLatch started = new CountDownLatch(4);
        CountDownLatch release = new CountDownLatch(1);
        when(processRunner.execute(eq(EXECUTABLE), anyList(), eq(TIMEOUT))).thenAnswer(invocation -> {
            started.countDown();
            if (!release.await(5, TimeUnit.SECONDS)) {
                throw new IllegalStateException("Test process gate timed out.");
            }
            return new YtDlpProcessRunner.ExecutionResult(
                    0, format(720, "mp4", "mp4", "https", "scontent.example.cdninstagram.com", "aac"),
                    "", false, false);
        });

        ExecutorService executor = Executors.newFixedThreadPool(4);
        try {
            List<Future<MediaResult>> inFlight = List.of(
                    executor.submit(() -> provider.resolve(validReelUrl())),
                    executor.submit(() -> provider.resolve(validReelUrl())),
                    executor.submit(() -> provider.resolve(validReelUrl())),
                    executor.submit(() -> provider.resolve(validReelUrl())));

            assertTrue(started.await(5, TimeUnit.SECONDS));
            assertEquals(MediaStatus.UNAVAILABLE, provider.resolve(validReelUrl()).status());
            release.countDown();
            for (Future<MediaResult> result : inFlight) {
                assertEquals(MediaStatus.READY, result.get(5, TimeUnit.SECONDS).status());
            }
        } finally {
            release.countDown();
            executor.shutdownNow();
        }
    }

    @Test
    void acceptsUnknownCodecMetadataWhenYtDlpSelectedItsProgressiveBestFormat() throws Exception {
        stubSuccess("{\"format_id\":\"3\",\"ext\":\"mp4\",\"url\":\"" + VALID_CDN_URL + "\"}");

        MediaResult result = provider.resolve(validReelUrl());

        assertEquals(MediaStatus.READY, result.status());
        assertEquals(URI.create(VALID_CDN_URL), result.mediaUrl());
    }

    @Test
    void rejectsMetadataThatExplicitlyDeclaresNoAudioStream() throws Exception {
        stubSuccess(format(720, "mp4", "mp4", "https", "scontent.example.cdninstagram.com", "none"));

        assertError(provider.resolve(validReelUrl()));
    }

    @Test
    void rejectsMetadataAboveThePreferred1080pLimit() throws Exception {
        stubSuccess(format(2160, "mp4", "mp4", "https", "scontent.example.cdninstagram.com", "aac"));

        assertError(provider.resolve(validReelUrl()));
    }

    @Test
    void rejectsCombinedSeparateAudioAndVideoFormatIds() throws Exception {
        stubSuccess("{\"format_id\":\"video+audio\",\"ext\":\"mp4\",\"url\":\"" + VALID_CDN_URL + "\"}");

        assertError(provider.resolve(validReelUrl()));
    }

    @Test
    void rejectsMetadataWithSeparateRequestedStreams() throws Exception {
        stubSuccess("{\"format_id\":\"video\",\"ext\":\"mp4\",\"url\":\"" + VALID_CDN_URL
                + "\",\"requested_formats\":[{},{}]}");

        assertError(provider.resolve(validReelUrl()));
    }

    @Test
    void rejectsNonHttpsMediaUrl() throws Exception {
        stubSuccess(format(720, "mp4", "mp4", "http", "scontent.example.cdninstagram.com", "aac"));

        assertError(provider.resolve(validReelUrl()));
    }

    @Test
    void rejectsHostOutsideCdnInstagramAllowlist() throws Exception {
        stubSuccess(format(720, "mp4", "mp4", "https", "media.example.com", "aac"));

        assertError(provider.resolve(validReelUrl()));
    }

    @Test
    void rejectsLookalikeCdnHostname() throws Exception {
        stubSuccess(format(720, "mp4", "mp4", "https", "cdninstagram.com.evil.example", "aac"));

        assertError(provider.resolve(validReelUrl()));
    }

    @Test
    void rejectsFormatWithMissingMediaUrl() throws Exception {
        stubSuccess("{\"format_id\":\"3\",\"ext\":\"mp4\"}");

        assertError(provider.resolve(validReelUrl()));
    }

    @Test
    void returnsErrorForMalformedJson() throws Exception {
        stubSuccess("{not-json");

        assertError(provider.resolve(validReelUrl()));
    }

    @Test
    void returnsSafeErrorWhenYtDlpExitsNonZero() throws Exception {
        when(processRunner.execute(eq(EXECUTABLE), org.mockito.ArgumentMatchers.anyList(), eq(TIMEOUT)))
                .thenReturn(new YtDlpProcessRunner.ExecutionResult(1, "", "private provider detail", false, false));

        MediaResult result = provider.resolve(validReelUrl());

        assertError(result);
        assertFalse(result.message().contains("private provider detail"));
    }

    @Test
    void returnsSafeTimeoutErrorWhenYtDlpTimesOut() throws Exception {
        when(processRunner.execute(eq(EXECUTABLE), org.mockito.ArgumentMatchers.anyList(), eq(TIMEOUT)))
                .thenThrow(new YtDlpProcessRunner.ProcessTimedOutException());

        MediaResult result = provider.resolve(validReelUrl());

        assertEquals(MediaStatus.ERROR, result.status());
        assertEquals("Media resolution timed out.", result.message());
        assertNull(result.mediaUrl());
    }

    @Test
    void downloadsOnlyBoundedProgressiveMp4WithAudioAndVideoAndCleansItOnClose() throws Exception {
        AtomicReference<List<String>> capturedArguments = new AtomicReference<>();
        AtomicReference<Path> capturedDirectory = new AtomicReference<>();
        byte[] mp4 = mp4WithTracks("vide", "soun");
        doAnswer(invocation -> {
            List<String> arguments = invocation.getArgument(1);
            capturedArguments.set(arguments);
            int outputIndex = arguments.indexOf("--output");
            Path output = Path.of(arguments.get(outputIndex + 1));
            capturedDirectory.set(output.getParent());
            Files.write(output, mp4);
            return new YtDlpProcessRunner.ExecutionResult(0, "", "", false, false);
        }).when(processRunner).execute(eq(EXECUTABLE), anyList(), eq(TIMEOUT), any(Path.class), anyLong());

        try (DownloadedMedia media = provider.download(validReelUrl())) {
            assertEquals("reelsave-ABC123.mp4", media.filename());
            assertEquals(mp4.length, media.sizeBytes());
            assertTrue(Files.exists(media.file()));
            List<String> arguments = capturedArguments.get();
            assertTrue(arguments.contains("--ignore-config"));
            assertTrue(arguments.contains("--no-cookies"));
            assertTrue(arguments.contains("--no-cookies-from-browser"));
            assertTrue(arguments.contains("--no-cache-dir"));
            assertTrue(arguments.contains("--no-playlist"));
            assertTrue(arguments.contains("--no-part"));
            assertEquals("52428800", arguments.get(arguments.indexOf("--max-filesize") + 1));
            assertEquals("best[ext=mp4][height<=1080]/best[ext=mp4]", arguments.get(arguments.indexOf("--format") + 1));
            assertEquals("0", arguments.get(arguments.indexOf("--retries") + 1));
            assertEquals("0", arguments.get(arguments.indexOf("--extractor-retries") + 1));
            assertEquals("0", arguments.get(arguments.indexOf("--fragment-retries") + 1));
            assertEquals(REEL, arguments.get(arguments.size() - 1));
        }

        assertFalse(Files.exists(capturedDirectory.get()));
    }

    @Test
    void appliesTheConfiguredDownloadLimitToYtDlpAndTheProcessMonitor() throws Exception {
        long configuredLimit = 1_048_576;
        YtDlpMediaProvider limitedProvider = new YtDlpMediaProvider(
                JsonMapper.builder().build(), processRunner, EXECUTABLE, TIMEOUT.toSeconds(), TIMEOUT.toSeconds(),
                configuredLimit);
        AtomicReference<List<String>> capturedArguments = new AtomicReference<>();
        AtomicReference<Long> monitoredLimit = new AtomicReference<>();
        byte[] mp4 = mp4WithTracks("vide", "soun");
        doAnswer(invocation -> {
            List<String> arguments = invocation.getArgument(1);
            capturedArguments.set(arguments);
            monitoredLimit.set(invocation.getArgument(4));
            Path output = Path.of(arguments.get(arguments.indexOf("--output") + 1));
            Files.write(output, mp4);
            return new YtDlpProcessRunner.ExecutionResult(0, "", "", false, false);
        }).when(processRunner).execute(eq(EXECUTABLE), anyList(), eq(TIMEOUT), any(Path.class), anyLong());

        try (DownloadedMedia ignored = limitedProvider.download(validReelUrl())) {
            assertEquals(Long.toString(configuredLimit),
                    capturedArguments.get().get(capturedArguments.get().indexOf("--max-filesize") + 1));
            assertEquals(configuredLimit, monitoredLimit.get());
        }
    }

    @Test
    void rejectsConfiguredDownloadLimitsAboveTheHardCap() {
        org.junit.jupiter.api.Assertions.assertThrows(IllegalArgumentException.class, () ->
                new YtDlpMediaProvider(JsonMapper.builder().build(), processRunner, EXECUTABLE,
                        TIMEOUT.toSeconds(), TIMEOUT.toSeconds(), 50L * 1024 * 1024 + 1));
    }

    @Test
    void refusesVideoWithoutAnAudioTrackAndCleansItsTemporaryFile() throws Exception {
        AtomicReference<Path> capturedDirectory = new AtomicReference<>();
        doAnswer(invocation -> {
            List<String> arguments = invocation.getArgument(1);
            Path output = Path.of(arguments.get(arguments.indexOf("--output") + 1));
            capturedDirectory.set(output.getParent());
            Files.write(output, mp4WithTracks("vide"));
            return new YtDlpProcessRunner.ExecutionResult(0, "", "", false, false);
        }).when(processRunner).execute(eq(EXECUTABLE), anyList(), eq(TIMEOUT), any(Path.class), anyLong());

        MediaDownloadException exception = org.junit.jupiter.api.Assertions.assertThrows(
                MediaDownloadException.class, () -> provider.download(validReelUrl()));

        assertEquals("The selected MP4 did not contain both video and audio streams.", exception.getMessage());
        assertFalse(Files.exists(capturedDirectory.get()));
    }

    @Test
    void doesNotReturnOrExposeAFileWhenDownloaderFails() throws Exception {
        when(processRunner.execute(eq(EXECUTABLE), anyList(), eq(TIMEOUT), any(Path.class), anyLong()))
                .thenReturn(new YtDlpProcessRunner.ExecutionResult(1, "", "private provider details", false, false));

        MediaDownloadException exception = org.junit.jupiter.api.Assertions.assertThrows(
                MediaDownloadException.class, () -> provider.download(validReelUrl()));

        assertEquals("Media could not be downloaded.", exception.getMessage());
        assertFalse(exception.getMessage().contains("private provider details"));
    }

    private void stubSuccess(String json) throws Exception {
        when(processRunner.execute(eq(EXECUTABLE), org.mockito.ArgumentMatchers.anyList(), eq(TIMEOUT)))
                .thenReturn(new YtDlpProcessRunner.ExecutionResult(0, json, "", false, false));
    }

    private static String format(int height, String ext, String videoExt, String scheme, String host, String audioCodec) {
        String fileName = height == 720 ? "video.mp4" : "video-" + height + ".mp4";
        return "{\"format_id\":\"3\",\"height\":" + height
                + ",\"ext\":\"" + ext
                + "\",\"video_ext\":\"" + videoExt
                + "\",\"vcodec\":\"h264\",\"acodec\":\"" + audioCodec
                + "\",\"url\":\"" + scheme + "://" + host + "/" + fileName + "\"}";
    }

    private static byte[] mp4WithTracks(String... trackHandlers) {
        byte[][] tracks = new byte[trackHandlers.length][];
        for (int index = 0; index < trackHandlers.length; index++) {
            byte[] handler = new byte[12];
            byte[] handlerType = trackHandlers[index].getBytes(StandardCharsets.US_ASCII);
            System.arraycopy(handlerType, 0, handler, 8, handlerType.length);
            tracks[index] = box("trak", box("mdia", box("hdlr", handler)));
        }

        byte[] movie = box("moov", concatenate(tracks));
        byte[] fileType = box("ftyp", new byte[] {'i', 's', 'o', 'm', 0, 0, 2, 0});
        return concatenate(fileType, movie);
    }

    private static byte[] box(String type, byte[] payload) {
        byte[] typeBytes = type.getBytes(StandardCharsets.US_ASCII);
        return ByteBuffer.allocate(8 + payload.length)
                .putInt(8 + payload.length)
                .put(typeBytes)
                .put(payload)
                .array();
    }

    private static byte[] concatenate(byte[]... arrays) {
        int length = java.util.Arrays.stream(arrays).mapToInt(array -> array.length).sum();
        ByteBuffer combined = ByteBuffer.allocate(length);
        for (byte[] array : arrays) {
            combined.put(array);
        }
        return combined.array();
    }

    private static void assertError(MediaResult result) {
        assertEquals(MediaStatus.ERROR, result.status());
        assertNull(result.mediaUrl());
        assertEquals("Media could not be resolved.", result.message());
    }

    private static ReelUrl validReelUrl() {
        return ReelUrl.parse(REEL).orElseThrow();
    }
}
