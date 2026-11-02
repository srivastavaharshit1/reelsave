package com.reelsave.controller;

import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.reelsave.domain.MediaResult;
import com.reelsave.domain.ReelUrl;
import com.reelsave.service.ReelMediaService;
import com.reelsave.service.ReelValidationService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

@WebMvcTest(ReelController.class)
@Import(ReelValidationService.class)
class ReelResolveControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private ReelMediaService reelMediaService;

    @Test
    void validReelUrlReachesMediaServiceAsValidatedValue() throws Exception {
        when(reelMediaService.resolve(org.mockito.ArgumentMatchers.any(ReelUrl.class)))
                .thenReturn(MediaResult.unavailable());

        mockMvc.perform(post("/api/v1/reels/resolve")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"url\":\"https://www.instagram.com/reel/ABC123/\"}"))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.status").value("UNAVAILABLE"));

        verify(reelMediaService).resolve(argThat(reelUrl ->
                reelUrl.uri().toString().equals("https://www.instagram.com/reel/ABC123/")));
    }

    @Test
    void invalidReelUrlDoesNotReachMediaService() throws Exception {
        mockMvc.perform(post("/api/v1/reels/resolve")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"url\":\"https://example.com/reel/ABC123/\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.valid").value(false));

        verifyNoInteractions(reelMediaService);
    }
}
