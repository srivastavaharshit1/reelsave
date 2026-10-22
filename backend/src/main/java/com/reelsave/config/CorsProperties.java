package com.reelsave.config;

import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "reelsave.cors")
public record CorsProperties(List<String> allowedOrigins) {
}
