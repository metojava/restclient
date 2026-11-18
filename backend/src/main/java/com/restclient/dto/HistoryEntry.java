package com.restclient.dto;

public record HistoryEntry(
        String id,
        long timestamp,
        HttpRequestDto request,
        int status,
        String statusText,
        long durationMs,
        long size
) {
}
