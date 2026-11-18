import time
from collections import deque
from threading import Lock
from uuid import uuid4

from errors import ApiError
from models import HttpRequestDto


def _now_ms() -> int:
    return int(time.time() * 1000)


class HistoryStore:
    def __init__(self, limit: int = 200):
        self._items: deque[dict] = deque(maxlen=limit)
        self._lock = Lock()

    def add(
        self,
        request: dict,
        status: int,
        status_text: str,
        duration_ms: int,
        size: int,
    ) -> dict:
        entry = {
            "id": str(uuid4()),
            "timestamp": _now_ms(),
            "request": request,
            "status": status,
            "statusText": status_text,
            "durationMs": duration_ms,
            "size": size,
        }
        with self._lock:
            self._items.appendleft(entry)
        return entry

    def list(self) -> list[dict]:
        with self._lock:
            return list(self._items)

    def clear(self) -> None:
        with self._lock:
            self._items.clear()


class CollectionStore:
    def __init__(self):
        self._items: dict[str, dict] = {}
        self._lock = Lock()

    def list(self) -> list[dict]:
        with self._lock:
            return [
                {
                    "id": collection["id"],
                    "name": collection["name"],
                    "requests": list(collection["requests"]),
                    "createdAt": collection["createdAt"],
                }
                for collection in self._items.values()
            ]

    def create(self, name: str | None) -> dict:
        collection = {
            "id": str(uuid4()),
            "name": (name or "").strip() or "New collection",
            "requests": [],
            "createdAt": _now_ms(),
        }
        with self._lock:
            self._items[collection["id"]] = collection
        return {
            "id": collection["id"],
            "name": collection["name"],
            "requests": [],
            "createdAt": collection["createdAt"],
        }

    def delete(self, collection_id: str) -> None:
        with self._lock:
            if self._items.pop(collection_id, None) is None:
                raise ApiError(404, "Collection not found")

    def save_request(
        self,
        collection_id: str,
        name: str | None,
        request: HttpRequestDto | None,
    ) -> dict:
        if request is None:
            raise ApiError(400, "Request is required")
        saved = {
            "id": str(uuid4()),
            "name": (name or "").strip()
            or f"{(request.method or 'GET').upper()} {request.url or ''}".strip(),
            "request": request.model_dump(),
            "savedAt": _now_ms(),
        }
        with self._lock:
            collection = self._items.get(collection_id)
            if collection is None:
                raise ApiError(404, "Collection not found")
            collection["requests"].append(saved)
        return saved

    def delete_request(self, collection_id: str, request_id: str) -> None:
        with self._lock:
            collection = self._items.get(collection_id)
            if collection is None:
                raise ApiError(404, "Collection not found")
            before = len(collection["requests"])
            collection["requests"] = [
                item for item in collection["requests"] if item["id"] != request_id
            ]
            if len(collection["requests"]) == before:
                raise ApiError(404, "Saved request not found")
