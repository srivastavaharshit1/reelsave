package com.reelsave.service;

import com.reelsave.dto.ReelValidationResponse;
import com.reelsave.domain.ReelUrl;
import java.util.Optional;
import org.springframework.stereotype.Service;

@Service
public class ReelValidationService {

    public ReelValidationResponse validate(String rawUrl) {
        return parseReelUrl(rawUrl).isPresent()
                ? ReelValidationResponse.validInstagramReel()
                : ReelValidationResponse.invalidInstagramReel();
    }

    public Optional<ReelUrl> parseReelUrl(String rawUrl) {
        return ReelUrl.parse(rawUrl);
    }
}
