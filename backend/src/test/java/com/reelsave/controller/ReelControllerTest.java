package com.reelsave.controller;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.hamcrest.Matchers.nullValue;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
class ReelControllerTest {

    private static final String VALID_MESSAGE = "Valid Instagram Reel URL.";
    private static final String INVALID_MESSAGE = "Please enter a valid Instagram Reel URL.";

    @Autowired
    private MockMvc mockMvc;

    @Test
    void acceptsInstagramReelUrlWithTrailingSlash() throws Exception {
        assertValid("https://www.instagram.com/reel/ABC123/");
    }

    @Test
    void acceptsInstagramReelUrlWithoutTrailingSlash() throws Exception {
        assertValid("https://instagram.com/reel/ABC123");
    }

    @Test
    void acceptsInstagramReelUrlWithQueryParameters() throws Exception {
        assertValid("https://www.instagram.com/reel/ABC123/?some_parameter=value");
    }

    @Test
    void rejectsExternalDomain() throws Exception {
        assertInvalid("https://example.com/reel/ABC123/");
    }

    @Test
    void rejectsInstagramProfileUrl() throws Exception {
        assertInvalid("https://www.instagram.com/someprofile/");
    }

    @Test
    void rejectsInstagramPostUrl() throws Exception {
        assertInvalid("https://www.instagram.com/p/ABC123/");
    }

    @Test
    void rejectsHttpUrl() throws Exception {
        assertInvalid("http://www.instagram.com/reel/ABC123/");
    }

    @Test
    void rejectsEmptyUrl() throws Exception {
        assertInvalid("");
    }

    @Test
    void rejectsMalformedUrl() throws Exception {
        assertInvalid("https://www.instagram.com/reel/invalid path");
    }

    @Test
    void rejectsJavascriptUrl() throws Exception {
        assertInvalid("javascript:alert(1)");
    }

    @Test
    void rejectsDataUrl() throws Exception {
        assertInvalid("data:text/html,hello");
    }

    @Test
    void rejectsPrivateIpAddress() throws Exception {
        assertInvalid("https://192.168.1.10/reel/ABC123/");
    }

    @Test
    void resolveReturnsUnavailableWhenNoMediaProviderIsConfigured() throws Exception {
        mockMvc.perform(post("/api/v1/reels/resolve")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"url\":\"https://www.instagram.com/reel/ABC123/\"}"))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.status").value("UNAVAILABLE"))
                .andExpect(jsonPath("$.message").value("Media download is not currently available."))
                .andExpect(jsonPath("$.mediaUrl").doesNotExist());
    }

    private void assertValid(String url) throws Exception {
        mockMvc.perform(post("/api/v1/reels/validate")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"url\":\"" + url + "\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.valid").value(true))
                .andExpect(jsonPath("$.platform").value("instagram"))
                .andExpect(jsonPath("$.type").value("reel"))
                .andExpect(jsonPath("$.message").value(VALID_MESSAGE));
    }

    private void assertInvalid(String url) throws Exception {
        mockMvc.perform(post("/api/v1/reels/validate")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"url\":\"" + url + "\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.valid").value(false))
                .andExpect(jsonPath("$.platform").value("instagram"))
                .andExpect(jsonPath("$.type").value(nullValue()))
                .andExpect(jsonPath("$.message").value(INVALID_MESSAGE));
    }
}
