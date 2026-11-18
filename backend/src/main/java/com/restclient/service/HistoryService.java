package com.restclient.service;

import com.restclient.dto.HistoryEntry;
import org.springframework.stereotype.Service;

import java.util.ArrayDeque;
import java.util.Deque;
import java.util.List;

@Service
public class HistoryService {

    private static final int MAX_ENTRIES = 200;

    private final Deque<HistoryEntry> entries = new ArrayDeque<>();

    public synchronized void add(HistoryEntry entry) {
        entries.addFirst(entry);
        while (entries.size() > MAX_ENTRIES) {
            entries.removeLast();
        }
    }

    public synchronized List<HistoryEntry> list() {
        return List.copyOf(entries);
    }

    public synchronized void clear() {
        entries.clear();
    }
}
