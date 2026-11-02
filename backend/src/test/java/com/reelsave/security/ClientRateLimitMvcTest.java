package com.reelsave.security;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest(properties = {
    "reelsave.rate-limit.requests-per-window=1",
    "reelsave.rate-limit.window-seconds=60"
})
@AutoConfigureMockMvc
class ClientRateLimitMvcTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void limitsPublicReelRequestsPerRemoteAddress() throws Exception {
        String remoteAddress = "198.51.100.23";
        String request = "{\"url\":\"https://www.instagram.com/reel/ABC123/\"}";

        mockMvc.perform(post("/api/v1/reels/validate")
                        .with(servletRequest -> {
                            servletRequest.setRemoteAddr(remoteAddress);
                            return servletRequest;
                        })
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(request))
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/v1/reels/validate")
                        .with(servletRequest -> {
                            servletRequest.setRemoteAddr(remoteAddress);
                            return servletRequest;
                        })
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(request))
                .andExpect(status().isTooManyRequests())
                .andExpect(header().exists("Retry-After"))
                .andExpect(jsonPath("$.status").value(429))
                .andExpect(jsonPath("$.title").value("Too many requests"));
    }

    @Test
    void doesNotGrantAnyCrossOriginByDefault() throws Exception {
        mockMvc.perform(options("/api/v1/reels/resolve")
                        .header("Origin", "http://localhost:5173")
                        .header("Access-Control-Request-Method", "POST")
                        .header("Access-Control-Request-Headers", "content-type"))
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.header()
                        .doesNotExist("Access-Control-Allow-Origin"));
    }
}
