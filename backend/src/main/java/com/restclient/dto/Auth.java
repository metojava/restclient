package com.restclient.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@JsonIgnoreProperties(ignoreUnknown = true)
public record Auth(
        String type,
        String username,
        String password,
        String token,
        String apiKeyName,
        String apiKeyValue,
        String apiKeyIn
) {
    public static Auth none() {
        return new Auth("none", null, null, null, null, null, null);
    }
}
