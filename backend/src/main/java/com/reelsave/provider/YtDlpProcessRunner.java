package com.reelsave.provider;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import org.springframework.stereotype.Component;

/** Runs yt-dlp as a subprocess without involving a shell. */
@Component
public class YtDlpProcessRunner {

    private static final int MAX_STDOUT_BYTES = 2_000_000;
    private static final int MAX_STDERR_BYTES = 128_000;

    public ExecutionResult execute(String executable, List<String> arguments, Duration timeout)
            throws IOException, InterruptedException, ProcessTimedOutException, OutputLimitExceededException {
        return execute(executable, arguments, timeout, null, Long.MAX_VALUE);
    }

    public ExecutionResult execute(
            String executable,
            List<String> arguments,
            Duration timeout,
            Path monitoredOutput,
            long maximumOutputBytes)
            throws IOException, InterruptedException, ProcessTimedOutException, OutputLimitExceededException {
        if (timeout == null || timeout.isZero() || timeout.isNegative() || maximumOutputBytes <= 0) {
            throw new IllegalArgumentException("A positive timeout and output limit are required.");
        }

        List<String> command = new ArrayList<>(arguments.size() + 1);
        command.add(executable);
        command.addAll(arguments);

        Process process = new ProcessBuilder(command).start();
        ExecutorService streamReaders = Executors.newVirtualThreadPerTaskExecutor();
        Future<CapturedOutput> stdoutFuture = streamReaders.submit(
                () -> readLimited(process.getInputStream(), MAX_STDOUT_BYTES));
        Future<CapturedOutput> stderrFuture = streamReaders.submit(
                () -> readLimited(process.getErrorStream(), MAX_STDERR_BYTES));

        try {
            waitForProcess(process, timeout, monitoredOutput, maximumOutputBytes);

            CapturedOutput stdout = awaitOutput(stdoutFuture);
            CapturedOutput stderr = awaitOutput(stderrFuture);
            return new ExecutionResult(
                    process.exitValue(),
                    stdout.value(),
                    stderr.value(),
                    stdout.truncated(),
                    stderr.truncated());
        } catch (InterruptedException exception) {
            terminate(process);
            Thread.currentThread().interrupt();
            throw exception;
        } catch (IOException exception) {
            if (process.isAlive()) {
                terminate(process);
            }
            throw exception;
        } finally {
            streamReaders.shutdownNow();
        }
    }

    private static void waitForProcess(Process process, Duration timeout, Path monitoredOutput, long maximumOutputBytes)
            throws IOException, InterruptedException, ProcessTimedOutException, OutputLimitExceededException {
        long deadline = System.nanoTime() + timeout.toNanos();
        while (process.isAlive()) {
            if (monitoredOutput != null
                    && Files.exists(monitoredOutput)
                    && Files.size(monitoredOutput) > maximumOutputBytes) {
                terminate(process);
                throw new OutputLimitExceededException();
            }

            long remainingNanos = deadline - System.nanoTime();
            if (remainingNanos <= 0) {
                terminate(process);
                throw new ProcessTimedOutException();
            }
            long waitMillis = Math.max(1, Math.min(TimeUnit.NANOSECONDS.toMillis(remainingNanos), 200));
            process.waitFor(waitMillis, TimeUnit.MILLISECONDS);
        }

        if (monitoredOutput != null
                && Files.exists(monitoredOutput)
                && Files.size(monitoredOutput) > maximumOutputBytes) {
            throw new OutputLimitExceededException();
        }
    }

    private static CapturedOutput awaitOutput(Future<CapturedOutput> future)
            throws IOException, InterruptedException {
        try {
            return future.get(2, TimeUnit.SECONDS);
        } catch (ExecutionException exception) {
            throw new IOException("Unable to capture yt-dlp output.", exception.getCause());
        } catch (TimeoutException exception) {
            throw new IOException("Timed out while capturing yt-dlp output.", exception);
        }
    }

    private static CapturedOutput readLimited(InputStream input, int maximumBytes) throws IOException {
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        byte[] buffer = new byte[8192];
        int totalBytes = 0;
        boolean truncated = false;
        int bytesRead;
        while ((bytesRead = input.read(buffer)) != -1) {
            int remaining = maximumBytes - totalBytes;
            int bytesToKeep = Math.min(remaining, bytesRead);
            if (bytesToKeep > 0) {
                output.write(buffer, 0, bytesToKeep);
                totalBytes += bytesToKeep;
            }
            if (bytesToKeep < bytesRead) {
                truncated = true;
            }
        }
        return new CapturedOutput(output.toString(StandardCharsets.UTF_8), truncated);
    }

    private static void terminate(Process process) {
        List<ProcessHandle> descendants = process.descendants().toList();
        descendants.forEach(ProcessHandle::destroy);
        process.destroy();
        try {
            if (!process.waitFor(500, TimeUnit.MILLISECONDS)) {
                descendants.stream().filter(ProcessHandle::isAlive).forEach(ProcessHandle::destroyForcibly);
                process.destroyForcibly();
                process.waitFor(1, TimeUnit.SECONDS);
            } else {
                descendants.stream().filter(ProcessHandle::isAlive).forEach(ProcessHandle::destroyForcibly);
            }
        } catch (InterruptedException exception) {
            descendants.stream().filter(ProcessHandle::isAlive).forEach(ProcessHandle::destroyForcibly);
            process.destroyForcibly();
            Thread.currentThread().interrupt();
        }
    }

    public record ExecutionResult(
            int exitCode,
            String stdout,
            String stderr,
            boolean stdoutTruncated,
            boolean stderrTruncated) {
    }

    private record CapturedOutput(String value, boolean truncated) {
    }

    public static class ProcessTimedOutException extends Exception {

        private static final long serialVersionUID = 1L;
    }

    public static class OutputLimitExceededException extends Exception {

        private static final long serialVersionUID = 1L;
    }
}
