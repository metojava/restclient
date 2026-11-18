package com.restclient.dto;

public record SavedRequest(
        String id,
        String name,
        HttpRequestDto request,
        long savedAt
) {
}
