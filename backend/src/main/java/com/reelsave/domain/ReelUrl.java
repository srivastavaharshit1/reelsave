package com.reelsave.domain;

import java.net.URI;
import java.net.URISyntaxException;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Pattern;

/** A URL that has passed ReelSave's Instagram Reel URL checks. */
public final class ReelUrl {

    private static final Set<String> ALLOWED_HOSTS = Set.of("instagram.com", "www.instagram.com");
    private static final Pattern REEL_PATH = Pattern.compile("^/reel/[A-Za-z0-9_-]+/?$");

    private final URI uri;

    private ReelUrl(URI uri) {
        this.uri = uri;
    }

    public static Optional<ReelUrl> parse(String rawUrl) {
        if (rawUrl == null || rawUrl.isBlank()) {
            return Optional.empty();
        }

        try {
            URI uri = new URI(rawUrl);
            if (!uri.isAbsolute()
                    || uri.getScheme() == null
                    || !"https".equalsIgnoreCase(uri.getScheme())
                    || uri.getRawUserInfo() != null
                    || uri.getPort() != -1
                    || uri.getRawFragment() != null) {
                return Optional.empty();
            }

            String host = uri.getHost();
            if (host == null || !ALLOWED_HOSTS.contains(host.toLowerCase(Locale.ROOT))) {
                return Optional.empty();
            }

            if (uri.getRawPath() == null || !REEL_PATH.matcher(uri.getRawPath()).matches()) {
                return Optional.empty();
            }

            return Optional.of(new ReelUrl(uri));
        } catch (URISyntaxException | IllegalArgumentException exception) {
            return Optional.empty();
        }
    }

    public URI uri() {
        return uri;
    }
}
