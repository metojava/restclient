package com.restclient.controller;

import com.restclient.dto.HistoryEntry;
import com.restclient.service.HistoryService;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/history")
public class HistoryController {

    private final HistoryService historyService;

    public HistoryController(HistoryService historyService) {
        this.historyService = historyService;
    }

    @GetMapping
    public List<HistoryEntry> list() {
        return historyService.list();
    }

    @DeleteMapping
    public void clear() {
        historyService.clear();
    }
}
