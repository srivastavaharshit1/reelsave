package com.reelsave.controller;

import com.reelsave.domain.MediaResult;
import com.reelsave.domain.MediaStatus;
import com.reelsave.domain.ReelUrl;
import com.reelsave.dto.ReelValidationRequest;
import com.reelsave.dto.ReelValidationResponse;
import com.reelsave.service.ReelMediaService;
import com.reelsave.service.ReelValidationService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import java.util.Optional;

@RestController
@RequestMapping("/api/v1/reels")
public class ReelController {

    private final ReelValidationService reelValidationService;
    private final ReelMediaService reelMediaService;

    public ReelController(ReelValidationService reelValidationService, ReelMediaService reelMediaService) {
        this.reelValidationService = reelValidationService;
        this.reelMediaService = reelMediaService;
    }

    @PostMapping("/validate")
    public ResponseEntity<ReelValidationResponse> validateReelUrl(
            @Valid @RequestBody ReelValidationRequest request) {
        ReelValidationResponse response = reelValidationService.validate(request.url());
        HttpStatus status = response.valid() ? HttpStatus.OK : HttpStatus.BAD_REQUEST;
        return ResponseEntity.status(status).body(response);
    }

    @PostMapping("/resolve")
    public ResponseEntity<?> resolveReel(
            @Valid @RequestBody ReelValidationRequest request) {
        Optional<ReelUrl> reelUrl = reelValidationService.parseReelUrl(request.url());
        if (reelUrl.isEmpty()) {
            return ResponseEntity.badRequest().body(ReelValidationResponse.invalidInstagramReel());
        }

        MediaResult result = reelMediaService.resolve(reelUrl.get());
        return ResponseEntity.status(toHttpStatus(result.status())).body(result);
    }

    private HttpStatus toHttpStatus(MediaStatus status) {
        return switch (status) {
            case READY -> HttpStatus.OK;
            case PROCESSING -> HttpStatus.ACCEPTED;
            case UNAVAILABLE -> HttpStatus.SERVICE_UNAVAILABLE;
            case ERROR -> HttpStatus.BAD_GATEWAY;
        };
    }
}
