package com.reelsave.service;

import com.reelsave.dto.HealthResponse;
import org.springframework.stereotype.Service;

@Service
public class HealthService {

    public HealthResponse getHealth() {
        return new HealthResponse("UP", "reelsave-api");
    }
}
