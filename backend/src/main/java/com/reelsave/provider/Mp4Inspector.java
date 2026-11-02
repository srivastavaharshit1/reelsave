package com.reelsave.provider;

import java.io.IOException;
import java.io.RandomAccessFile;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;

/** Reads MP4 container headers without loading media payloads into memory. */
public final class Mp4Inspector {

    private Mp4Inspector() {}

    public static Inspection inspect(Path path) throws IOException {
        try (RandomAccessFile file = new RandomAccessFile(path.toFile(), "r")) {
            long fileLength = file.length();
            boolean hasFileTypeBox = false;
            boolean hasVideo = false;
            boolean hasAudio = false;

            for (long offset = 0; offset < fileLength; ) {
                Box box = readBox(file, offset, fileLength);
                if (box == null) {
                    break;
                }

                if ("ftyp".equals(box.type())) {
                    hasFileTypeBox = true;
                } else if ("moov".equals(box.type())) {
                    Inspection tracks = inspectMovie(file, box);
                    hasVideo |= tracks.hasVideo();
                    hasAudio |= tracks.hasAudio();
                }
                offset = box.end();
            }

            return new Inspection(hasFileTypeBox, hasVideo, hasAudio);
        }
    }

    private static Inspection inspectMovie(RandomAccessFile file, Box movie) throws IOException {
        boolean hasVideo = false;
        boolean hasAudio = false;

        for (long offset = movie.payloadStart(); offset < movie.end(); ) {
            Box box = readBox(file, offset, movie.end());
            if (box == null) {
                break;
            }
            if ("trak".equals(box.type())) {
                String handler = inspectTrack(file, box);
                hasVideo |= "vide".equals(handler);
                hasAudio |= "soun".equals(handler);
            }
            offset = box.end();
        }

        return new Inspection(true, hasVideo, hasAudio);
    }

    private static String inspectTrack(RandomAccessFile file, Box track) throws IOException {
        for (long offset = track.payloadStart(); offset < track.end(); ) {
            Box box = readBox(file, offset, track.end());
            if (box == null) {
                break;
            }
            if ("mdia".equals(box.type())) {
                String handler = inspectMedia(file, box);
                if (handler != null) {
                    return handler;
                }
            }
            offset = box.end();
        }
        return null;
    }

    private static String inspectMedia(RandomAccessFile file, Box media) throws IOException {
        for (long offset = media.payloadStart(); offset < media.end(); ) {
            Box box = readBox(file, offset, media.end());
            if (box == null) {
                break;
            }
            if ("hdlr".equals(box.type()) && box.end() - box.payloadStart() >= 12) {
                file.seek(box.payloadStart() + 8);
                byte[] handler = new byte[4];
                file.readFully(handler);
                return new String(handler, StandardCharsets.US_ASCII);
            }
            offset = box.end();
        }
        return null;
    }

    private static Box readBox(RandomAccessFile file, long offset, long parentEnd) throws IOException {
        if (offset < 0 || parentEnd - offset < 8) {
            return null;
        }

        file.seek(offset);
        long size = Integer.toUnsignedLong(file.readInt());
        byte[] typeBytes = new byte[4];
        file.readFully(typeBytes);
        int headerSize = 8;

        if (size == 1) {
            if (parentEnd - offset < 16) {
                return null;
            }
            size = file.readLong();
            headerSize = 16;
            if (size < 0) {
                return null;
            }
        } else if (size == 0) {
            size = parentEnd - offset;
        }

        if (size < headerSize || size > parentEnd - offset) {
            return null;
        }

        String type = new String(typeBytes, StandardCharsets.US_ASCII);
        return new Box(type, offset + headerSize, offset + size);
    }

    public record Inspection(boolean isMp4, boolean hasVideo, boolean hasAudio) {}

    private record Box(String type, long payloadStart, long end) {}
}
