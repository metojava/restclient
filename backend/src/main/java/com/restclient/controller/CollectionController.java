package com.restclient.controller;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.restclient.dto.Collection;
import com.restclient.dto.HttpRequestDto;
import com.restclient.dto.SavedRequest;
import com.restclient.service.CollectionService;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/collections")
public class CollectionController {

    private final CollectionService collectionService;

    public CollectionController(CollectionService collectionService) {
        this.collectionService = collectionService;
    }

    @GetMapping
    public List<Collection> list() {
        return collectionService.list();
    }

    @PostMapping
    public Collection create(@RequestBody CreateCollectionBody body) {
        return collectionService.create(body == null ? null : body.name());
    }

    @DeleteMapping("/{collectionId}")
    public void delete(@PathVariable String collectionId) {
        collectionService.delete(collectionId);
    }

    @PostMapping("/{collectionId}/requests")
    public SavedRequest saveRequest(@PathVariable String collectionId, @RequestBody SaveRequestBody body) {
        return collectionService.saveRequest(collectionId, body == null ? null : body.name(),
                body == null ? null : body.request());
    }

    @DeleteMapping("/{collectionId}/requests/{requestId}")
    public void deleteRequest(@PathVariable String collectionId, @PathVariable String requestId) {
        collectionService.deleteRequest(collectionId, requestId);
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record CreateCollectionBody(String name) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record SaveRequestBody(String name, HttpRequestDto request) {
    }
}
