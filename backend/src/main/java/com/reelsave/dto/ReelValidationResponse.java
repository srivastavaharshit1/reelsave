package com.reelsave.dto;

public record ReelValidationResponse(boolean valid, String platform, String type, String message) {

    public static ReelValidationResponse validInstagramReel() {
        return new ReelValidationResponse(true, "instagram", "reel", "Valid Instagram Reel URL.");
    }

    public static ReelValidationResponse invalidInstagramReel() {
        return new ReelValidationResponse(
                false, "instagram", null, "Please enter a valid Instagram Reel URL.");
    }
}
