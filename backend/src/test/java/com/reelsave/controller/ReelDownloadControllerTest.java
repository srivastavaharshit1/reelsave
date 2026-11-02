package com.reelsave.controller;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.asyncDispatch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.request;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.reelsave.domain.ReelUrl;
import com.reelsave.provider.DownloadedMedia;
import com.reelsave.provider.MediaDownloadProvider;
import com.reelsave.service.ReelMediaService;
import com.reelsave.service.ReelValidationService;
import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

@WebMvcTest(value = ReelController.class, properties = "reelsave.cors.allowed-origins=http://localhost:5173")
@Import(ReelValidationService.class)
class ReelDownloadControllerTest {

    private static final String REEL = "https://www.instagram.com/reel/ABC123/";

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private ReelMediaService reelMediaService;

    @MockitoBean
    private MediaDownloadProvider mediaDownloadProvider;

    @Test
    void allowsTheConfiguredFrontendOriginAndOnlyRequiredRequestHeaders() throws Exception {
        mockMvc.perform(options("/api/v1/reels/resolve")
                        .header("Origin", "http://localhost:5173")
                        .header("Access-Control-Request-Method", "POST")
                        .header("Access-Control-Request-Headers", "content-type"))
                .andExpect(status().isOk())
                .andExpect(header().string("Access-Control-Allow-Origin", "http://localhost:5173"))
                .andExpect(header().string("Access-Control-Allow-Methods", org.hamcrest.Matchers.containsString("POST")))
                .andExpect(header().string("Access-Control-Allow-Headers", org.hamcrest.Matchers.containsString("content-type")));
    }

    @Test
    void rejectsNonInstagramUrlsBeforeCallingTheDownloadProvider() throws Exception {
        mockMvc.perform(post("/api/v1/reels/download")
                        .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                        .param("url", "https://example.com/video.mp4"))
                .andExpect(status().isBadRequest())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON));

        verifyNoInteractions(mediaDownloadProvider);
    }

    @Test
    void streamsTemporaryMp4WithSafeAttachmentFilenameAndDeletesTheFile() throws Exception {
        Path directory = Files.createTempDirectory("reelsave-test-");
        Path file = directory.resolve("reelsave-ABC123.mp4");
        byte[] bytes = new byte[] {0, 0, 0, 16, 'f', 't', 'y', 'p', 'i', 's', 'o', 'm'};
        Files.write(file, bytes);
        when(mediaDownloadProvider.download(any(ReelUrl.class)))
                .thenReturn(new DownloadedMedia(directory, file, "reelsave-ABC123.mp4", bytes.length, () -> {}));

        MvcResult initialResponse = mockMvc.perform(post("/api/v1/reels/download")
                        .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                        .param("url", REEL))
                .andExpect(status().isOk())
                .andExpect(content().contentType("video/mp4"))
                .andExpect(header().string("Content-Disposition", org.hamcrest.Matchers.containsString("attachment")))
                .andExpect(header().string("Content-Disposition", org.hamcrest.Matchers.containsString("reelsave-ABC123.mp4")))
                .andExpect(request().asyncStarted())
                .andReturn();

        mockMvc.perform(asyncDispatch(initialResponse))
                .andExpect(status().isOk())
                .andExpect(content().bytes(bytes));

        verify(mediaDownloadProvider).download(org.mockito.ArgumentMatchers.argThat(
                value -> value.uri().toString().equals(REEL)));
        assertFalse(Files.exists(file));
        assertFalse(Files.exists(directory));
    }
}
