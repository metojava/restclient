package com.restclient.dto;

import java.util.List;

public record HttpResponseDto(
        int status,
        String statusText,
        String body,
        String contentType,
        boolean binary,
        long timeMs,
        long size,
        List<HeaderEntry> headers
) {
}
