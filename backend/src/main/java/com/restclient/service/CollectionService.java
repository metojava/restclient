package com.restclient.service;

import com.restclient.dto.Collection;
import com.restclient.dto.HttpRequestDto;
import com.restclient.dto.SavedRequest;
import com.restclient.exception.ApiException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class CollectionService {

    private final Map<String, Collection> collections = new LinkedHashMap<>();

    public synchronized List<Collection> list() {
        return List.copyOf(collections.values());
    }

    public synchronized Collection create(String name) {
        String cleanName = name == null || name.isBlank() ? "New collection" : name.trim();
        Collection collection = new Collection(
                UUID.randomUUID().toString(),
                cleanName,
                new ArrayList<>(),
                System.currentTimeMillis());
        collections.put(collection.id(), collection);
        return collection;
    }

    public synchronized void delete(String collectionId) {
        if (collections.remove(collectionId) == null) {
            throw new ApiException(HttpStatus.NOT_FOUND, "Collection not found");
        }
    }

    public synchronized SavedRequest saveRequest(String collectionId, String name, HttpRequestDto request) {
        Collection collection = collections.get(collectionId);
        if (collection == null) {
            throw new ApiException(HttpStatus.NOT_FOUND, "Collection not found");
        }
        if (request == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Request is required");
        }
        SavedRequest saved = new SavedRequest(
                UUID.randomUUID().toString(),
                name == null || name.isBlank() ? defaultName(request) : name.trim(),
                request,
                System.currentTimeMillis());

        List<SavedRequest> requests = new ArrayList<>(collection.requests());
        requests.add(saved);
        collections.put(collectionId, new Collection(
                collection.id(), collection.name(), requests, collection.createdAt()));
        return saved;
    }

    public synchronized void deleteRequest(String collectionId, String requestId) {
        Collection collection = collections.get(collectionId);
        if (collection == null) {
            throw new ApiException(HttpStatus.NOT_FOUND, "Collection not found");
        }
        boolean removed = collection.requests().removeIf(r -> r.id().equals(requestId));
        if (!removed) {
            throw new ApiException(HttpStatus.NOT_FOUND, "Saved request not found");
        }
    }

    private String defaultName(HttpRequestDto request) {
        String url = request.url() == null ? "" : request.url();
        return (request.method() == null ? "GET" : request.method()) + " " + url;
    }
}
