package com.restclient.dto;

import java.util.List;

public record Collection(
        String id,
        String name,
        List<SavedRequest> requests,
        long createdAt
) {
}
