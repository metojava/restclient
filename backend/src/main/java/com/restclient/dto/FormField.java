package com.restclient.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@JsonIgnoreProperties(ignoreUnknown = true)
public record FormField(
        String key,
        String value,
        String type,
        String fileName,
        String contentType,
        String fileBase64,
        Boolean enabled
) {

    public boolean isOn() {
        return enabled == null || enabled;
    }

    public boolean isFile() {
        return "file".equalsIgnoreCase(type);
    }
}
