package com.restclient.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.util.List;

@JsonIgnoreProperties(ignoreUnknown = true)
public record HttpRequestDto(
        String method,
        String url,
        List<KeyValue> params,
        List<KeyValue> headers,
        Auth auth,
        RequestBody body,
        Integer timeoutMs,
        Boolean followRedirects,
        Boolean disableTlsVerification
) {
}
