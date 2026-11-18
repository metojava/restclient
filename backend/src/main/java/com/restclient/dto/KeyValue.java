package com.restclient.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@JsonIgnoreProperties(ignoreUnknown = true)
public record KeyValue(String key, String value, Boolean enabled) {

    public boolean isOn() {
        return enabled == null || enabled;
    }
}
