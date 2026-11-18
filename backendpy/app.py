"""Python implementation of the RestClient backend.

Run with:
    python app.py
or:
    python -m uvicorn app:app --host 127.0.0.1 --port 8080

The API is identical to the Java backend in ../backend, so the React frontend
works with either one without changes.
"""

import logging
import os
from datetime import datetime, timezone
from http import HTTPStatus

import uvicorn
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from errors import ApiError
from executor import execute
from models import HttpRequestDto
from stores import CollectionStore, HistoryStore

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("restclient")

app = FastAPI(title="RestClient Python backend", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

history = HistoryStore()
collections = CollectionStore()


def _error_body(status: int, message: str) -> dict:
    try:
        phrase = HTTPStatus(status).phrase
    except ValueError:
        phrase = "Error"
    return {"error": phrase, "status": status, "message": message}


@app.exception_handler(ApiError)
def handle_api_error(_request: Request, exc: ApiError):
    return JSONResponse(
        status_code=exc.status,
        content=_error_body(exc.status, exc.message),
    )


@app.exception_handler(RequestValidationError)
def handle_validation_error(_request: Request, exc: RequestValidationError):
    details = "; ".join(
        f"{'.'.join(str(part) for part in error.get('loc', []))}: {error.get('msg', 'invalid value')}"
        for error in exc.errors()
    )
    return JSONResponse(
        status_code=400,
        content=_error_body(400, details or "Invalid request payload"),
    )


@app.exception_handler(Exception)
def handle_unexpected_error(_request: Request, exc: Exception):
    logger.exception("Unexpected error", exc_info=exc)
    return JSONResponse(
        status_code=500,
        content=_error_body(500, f"Unexpected error: {exc}"),
    )


@app.get("/api/health")
def health():
    return {
        "status": "UP",
        "service": "restclient-backend-python",
        "time": datetime.now(timezone.utc).isoformat(),
    }


@app.post("/api/request")
def execute_request(payload: HttpRequestDto):
    result = execute(payload)
    history.add(
        payload.model_dump(),
        result["status"],
        result["statusText"],
        result["timeMs"],
        result["size"],
    )
    return result


@app.get("/api/history")
def list_history():
    return history.list()


@app.delete("/api/history", status_code=204)
def clear_history():
    history.clear()


@app.get("/api/collections")
def list_collections():
    return collections.list()


class CreateCollectionBody(BaseModel):
    name: str | None = None


class SaveRequestBody(BaseModel):
    name: str | None = None
    request: HttpRequestDto | None = None


@app.post("/api/collections")
def create_collection(body: CreateCollectionBody | None = None):
    return collections.create(body.name if body else None)


@app.delete("/api/collections/{collection_id}", status_code=204)
def delete_collection(collection_id: str):
    collections.delete(collection_id)


@app.post("/api/collections/{collection_id}/requests")
def save_request(collection_id: str, body: SaveRequestBody):
    return collections.save_request(collection_id, body.name, body.request)


@app.delete("/api/collections/{collection_id}/requests/{request_id}", status_code=204)
def delete_saved_request(collection_id: str, request_id: str):
    collections.delete_request(collection_id, request_id)


if __name__ == "__main__":
    port = int(os.getenv("PORT", "8080"))
    print(f"RestClient Python backend listening on http://127.0.0.1:{port}")
    uvicorn.run(app, host="127.0.0.1", port=port)
