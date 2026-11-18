# RestClient

A local, Postman-style HTTP client with **two interchangeable backends**:

- **Java backend** — Java 21 + Spring Boot 3 (Maven), folder `backend/`
- **Python backend** — Python 3.10+ + FastAPI, folder `backendpy/`
- **Frontend** — React 18 + TypeScript + Vite, folder `frontend/`
- Both backends expose the **same `/api` contract**, so the UI works with either one unchanged.
- One-click Windows launchers for **Java**, **Python**, or **frontend-only**.

## Features

- Any HTTP method: GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS
- Full control over **URL, query params, headers, authorization and request body**
- Auth helpers: **Basic, Bearer token, API key** (header or query param)
- Body types: **JSON, raw text, XML, `application/x-www-form-urlencoded`, `multipart/form-data`** (including file uploads)
- Response viewer with status, time, size, pretty-printed JSON, headers, image preview and file download
- Per-request timeout, redirect control and optional **TLS verification bypass** (self-signed certificates)
- Environment **variables** (`{{token}}`) substituted into every field
- Request **history** (last 200) and **collections** with named saved requests
- Copy any request as a **cURL** command
- Requests and cookies persist in the backend while it runs; the draft request and variables also survive reloads via `localStorage`

## Requirements

| Tool | Version | Needed for |
| --- | --- | --- |
| JDK | 21+ | Java backend |
| Maven | 3.9+ | Building the Java backend |
| Python | 3.10+ | Python backend |
| Node.js | 18+ (npm included) | Frontend |

## Pick a backend

| Script | What it starts / does |
| --- | --- |
| `start-java.bat` | Java backend on `:8080` + React frontend on `:5173` |
| `start-java.bat backend` | Java backend only (no UI, no browser) |
| `start-python.bat` | Python backend on `:8080` + React frontend on `:5173` |
| `start-python.bat backend` | Python backend only (no UI, no browser) |
| `start-frontend.bat` | Frontend only (expects a backend on `:8080`) |
| `start.bat` | Shortcut for Java; `start.bat python` for Python; `start.bat python backend` for Python only |
| `start.bat --rebuild` | Rebuild the Java JAR, then launch Java + frontend |
| `build.bat` | Build Java JAR, prepare the Python environment and build the frontend bundle |
| `build-python.bat` | Prepare/repair only the Python environment and syntax-check its sources |
| `stop.bat` | Stop whatever is listening on ports `8080` and `5173` |

There is no separate backend-only script: pass `backend` to either start script instead. Both backends use port
`8080`, so run only one at a time. If the port is busy, the launcher tells you to run `stop.bat` first.

### First run

- **Java:** builds `backend/target/restclient-backend.jar` with Maven if missing.
- **Python:** creates `backendpy/.venv` and installs `backendpy/requirements.txt` if needed.
- **Frontend:** runs `npm install` if `frontend/node_modules` is missing.
- The script opens <http://localhost:5173> after a short delay.

Python is interpreted, so it has no compiled artifact: preparing `backendpy/.venv` **is** its build step.
`build.bat` does all three; `build-python.bat` does only the Python part.

## Manual start

```bat
:: Java backend
cd backend
mvn spring-boot:run

:: Python backend
cd backendpy
python -m venv .venv
.venv\Scripts\python.exe -m pip install -r requirements.txt
.venv\Scripts\python.exe -m uvicorn app:app --host 127.0.0.1 --port 8080

:: Frontend
cd frontend
npm install
npm run dev
```

## Project layout

```
restclient/
├─ start.bat                 java | python launcher
├─ start-java.bat            Java backend + frontend (or backend only)
├─ start-python.bat          Python backend + frontend (or backend only)
├─ start-frontend.bat        frontend only
├─ build.bat                 Java + Python + frontend build
├─ build-python.bat          Python environment only
├─ stop.bat
├─ backend/                  Java 21 + Spring Boot
│  ├─ pom.xml
│  └─ src/main/java/com/restclient/
│     ├─ RestClientApplication.java
│     ├─ config/            CORS
│     ├─ controller/        /api/request, /api/history, /api/collections
│     ├─ dto/               request/response/history records
│     ├─ exception/         API error handling
│     └─ service/           HTTP execution, history, collections
├─ backendpy/                Python 3.10+ + FastAPI
│  ├─ app.py                routes, CORS, error handlers
│  ├─ executor.py           HTTP execution via requests
│  ├─ models.py             Pydantic DTOs (same JSON shape as Java)
│  ├─ stores.py             in-memory history and collections
│  ├─ errors.py             API error type
│  └─ requirements.txt
└─ frontend/
   ├─ vite.config.ts        dev proxy /api -> localhost:8080
   └─ src/
      ├─ App.tsx            state, shortcuts, save/load flows
      ├─ api.ts             typed API client
      ├─ utils.ts           wire conversion, variables, cURL export
      └─ components/        sidebar, request builder, response viewer, modal
```

## API (identical for both backends)

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/api/request` | Execute an HTTP request and return the response |
| `GET` | `/api/health` | Health check |
| `GET` | `/api/history` | List recent requests |
| `DELETE` | `/api/history` | Clear history |
| `GET` | `/api/collections` | List collections |
| `POST` | `/api/collections` | Create a collection |
| `DELETE` | `/api/collections/{id}` | Delete a collection |
| `POST` | `/api/collections/{id}/requests` | Save a request |
| `DELETE` | `/api/collections/{id}/requests/{requestId}` | Delete a saved request |

Example request payload:

```json
{
  "method": "POST",
  "url": "https://httpbin.org/post",
  "params": [{ "key": "page", "value": "1", "enabled": true }],
  "headers": [{ "key": "X-Client", "value": "RestClient", "enabled": true }],
  "auth": { "type": "bearer", "token": "my-token" },
  "body": { "type": "json", "content": "{\"hello\":\"world\"}" },
  "timeoutMs": 30000,
  "followRedirects": true,
  "disableTlsVerification": false
}
```

Error responses use the same shape from both backends:

```json
{ "error": "Bad Gateway", "status": 502, "message": "Unknown host: example.invalid" }
```

## Behavior notes

- History and collections are kept **in memory** and reset when a backend restarts.
- Cookies set by responses are kept in a shared cookie jar, so login sessions carry over between requests.
- Python's `requests` applies its timeout to connect and read operations (the Java backend applies a request timeout).
- Both backends are local development tools and can reach any URL you give them. Do not expose them on a public network.
