package com.restclient.controller;

import com.restclient.dto.HistoryEntry;
import com.restclient.dto.HttpRequestDto;
import com.restclient.dto.HttpResponseDto;
import com.restclient.service.HistoryService;
import com.restclient.service.HttpExecutionService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api")
public class RequestController {

    private final HttpExecutionService executionService;
    private final HistoryService historyService;

    public RequestController(HttpExecutionService executionService, HistoryService historyService) {
        this.executionService = executionService;
        this.historyService = historyService;
    }

    @PostMapping("/request")
    public HttpResponseDto execute(@RequestBody HttpRequestDto request) {
        HttpResponseDto response = executionService.execute(request);
        historyService.add(new HistoryEntry(
                UUID.randomUUID().toString(),
                Instant.now().toEpochMilli(),
                request,
                response.status(),
                response.statusText(),
                response.timeMs(),
                response.size()));
        return response;
    }

    @GetMapping("/health")
    public Map<String, Object> health() {
        return Map.of(
                "status", "UP",
                "service", "restclient-backend",
                "time", Instant.now().toString());
    }
}
