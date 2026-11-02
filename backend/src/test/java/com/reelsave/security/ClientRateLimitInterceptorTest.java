package com.reelsave.security;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import tools.jackson.databind.json.JsonMapper;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

class ClientRateLimitInterceptorTest {

    @Test
    void returns429AndRetryAfterWhenClientExceedsItsWindow() throws Exception {
        ClientRateLimitInterceptor interceptor = new ClientRateLimitInterceptor(JsonMapper.builder().build(), true, 1, 60, 100);
        MockHttpServletRequest request = request("203.0.113.7", "/api/v1/reels/resolve", "POST");

        assertTrue(interceptor.preHandle(request, new MockHttpServletResponse(), new Object()));

        MockHttpServletResponse limitedResponse = new MockHttpServletResponse();
        assertFalse(interceptor.preHandle(request, limitedResponse, new Object()));
        assertEquals(429, limitedResponse.getStatus());
        assertTrue(Long.parseLong(limitedResponse.getHeader("Retry-After")) > 0);
        assertEquals("application/problem+json", limitedResponse.getContentType());
        assertTrue(limitedResponse.getContentAsString().contains("Too many requests"));
    }

    @Test
    void doesNotLimitNonPostRequests() throws Exception {
        ClientRateLimitInterceptor interceptor = new ClientRateLimitInterceptor(JsonMapper.builder().build(), true, 1, 60, 100);

        assertTrue(interceptor.preHandle(
                request("203.0.113.8", "/api/v1/health", "GET"), new MockHttpServletResponse(), new Object()));
        assertTrue(interceptor.preHandle(
                request("203.0.113.8", "/api/v1/reels/resolve", "OPTIONS"), new MockHttpServletResponse(), new Object()));
    }

    private static MockHttpServletRequest request(String address, String path, String method) {
        MockHttpServletRequest request = new MockHttpServletRequest(method, path);
        request.setRemoteAddr(address);
        return request;
    }
}
