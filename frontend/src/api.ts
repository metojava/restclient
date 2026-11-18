import type {
  ApiResponse,
  Collection,
  HistoryEntry,
  SavedRequest,
  WireRequest,
} from './types';

const BASE = '/api';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(BASE + path, init);
  if (!res.ok) {
    let message = `${res.status} ${res.statusText}`;
    try {
      const data = await res.json();
      message = data.message || data.error || message;
    } catch {
      // response had no JSON body
    }
    throw new Error(message);
  }
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

function json(method: string, body?: unknown): RequestInit {
  return {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  };
}

export const api = {
  health: () => request<{ status: string; service: string }>('/health'),

  execute: (payload: WireRequest) => request<ApiResponse>('/request', json('POST', payload)),

  history: () => request<HistoryEntry[]>('/history'),
  clearHistory: () => request<void>('/history', { method: 'DELETE' }),

  collections: () => request<Collection[]>('/collections'),
  createCollection: (name: string) =>
    request<Collection>('/collections', json('POST', { name })),
  deleteCollection: (collectionId: string) =>
    request<void>(`/collections/${collectionId}`, { method: 'DELETE' }),
  saveRequest: (collectionId: string, body: { name: string; request: WireRequest }) =>
    request<SavedRequest>(`/collections/${collectionId}/requests`, json('POST', body)),
  deleteSavedRequest: (collectionId: string, requestId: string) =>
    request<void>(`/collections/${collectionId}/requests/${requestId}`, { method: 'DELETE' }),
};
