import base64
import codecs
import re
import time
from urllib.parse import quote, urlencode

import requests
import urllib3
from urllib3.exceptions import InsecureRequestWarning

from errors import ApiError
from models import Auth, HttpRequestDto, RequestBody

urllib3.disable_warnings(InsecureRequestWarning)

_session = requests.Session()
_session.max_redirects = 30

RESTRICTED_HEADERS = {
    "connection",
    "content-length",
    "expect",
    "host",
    "upgrade",
    "transfer-encoding",
}

TEXTUAL_MARKERS = (
    "json",
    "xml",
    "javascript",
    "ecmascript",
    "x-www-form-urlencoded",
    "graphql",
    "yaml",
    "yml",
    "csv",
    "html",
    "svg",
    "problem+json",
    "ld+json",
)

HEADER_NAME_RE = re.compile(r"^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$")
SCHEME_RE = re.compile(r"^[a-zA-Z][a-zA-Z0-9+.-]*://")
CHARSET_RE = re.compile(r'charset\s*=\s*"?([A-Za-z0-9._-]+)', re.IGNORECASE)


def execute(request: HttpRequestDto) -> dict:
    method = _normalize_method(request.method)
    url = _build_url(request.url, request)

    headers: dict[str, str] = {}
    for header in request.headers:
        if not header.enabled or not header.key.strip():
            continue
        name = header.key.strip()
        value = header.value or ""
        if name.lower() in RESTRICTED_HEADERS:
            continue
        if not HEADER_NAME_RE.match(name) or "\r" in value or "\n" in value:
            continue
        headers[name] = value

    _apply_auth(headers, request.auth)
    body_options = _prepare_body(request.body, headers)

    timeout_ms = request.timeoutMs if request.timeoutMs and request.timeoutMs > 0 else 30_000
    timeout_ms = max(1, min(timeout_ms, 600_000))
    timeout_seconds = timeout_ms / 1000.0

    start = time.perf_counter()
    try:
        response = _session.request(
            method,
            url,
            headers=headers,
            timeout=(min(timeout_seconds, 15.0), timeout_seconds),
            allow_redirects=request.followRedirects is not False,
            verify=not bool(request.disableTlsVerification),
            **body_options,
        )
    except requests.exceptions.Timeout as exc:
        raise ApiError(504, f"Request timed out after {timeout_ms} ms") from exc
    except requests.exceptions.SSLError as exc:
        raise ApiError(
            502,
            f"TLS/SSL error: {exc}. Try enabling 'Disable TLS verification'.",
        ) from exc
    except (
        requests.exceptions.InvalidURL,
        requests.exceptions.MissingSchema,
        requests.exceptions.InvalidSchema,
        requests.exceptions.URLRequired,
    ) as exc:
        raise ApiError(400, f"Invalid URL: {request.url}") from exc
    except requests.exceptions.TooManyRedirects as exc:
        raise ApiError(502, "Too many redirects") from exc
    except requests.exceptions.ConnectionError as exc:
        detail = str(exc)
        host = _host_of(url)
        if any(
            marker in detail
            for marker in ("Name or service not known", "getaddrinfo failed", "NameResolutionError")
        ):
            raise ApiError(502, f"Unknown host: {host}") from exc
        raise ApiError(502, f"Could not connect to {host}. Is the server running?") from exc
    except requests.exceptions.RequestException as exc:
        raise ApiError(502, f"Request failed: {exc}") from exc

    elapsed_ms = int(round((time.perf_counter() - start) * 1000))
    content = response.content or b""
    content_type = response.headers.get("Content-Type", "")
    binary = _is_binary(content_type)

    if binary:
        body = base64.b64encode(content).decode("ascii")
    else:
        body = content.decode(_charset_of(content_type), errors="replace")

    response_headers = []
    try:
        for name, value in response.raw.headers.items():
            response_headers.append({"name": name, "value": value})
    except AttributeError:
        for name, value in response.headers.items():
            response_headers.append({"name": name, "value": value})

    return {
        "status": response.status_code,
        "statusText": str(response.reason or ""),
        "body": body,
        "contentType": content_type,
        "binary": binary,
        "timeMs": elapsed_ms,
        "size": len(content),
        "headers": response_headers,
    }


def _normalize_method(method: str | None) -> str:
    value = (method or "GET").strip().upper()
    if not re.fullmatch(r"[A-Z]+", value):
        raise ApiError(400, f"Invalid HTTP method: {method}")
    return value


def _build_url(raw_url: str | None, request: HttpRequestDto) -> str:
    if raw_url is None or not raw_url.strip():
        raise ApiError(400, "URL is required")

    url = raw_url.strip()
    if not SCHEME_RE.match(url):
        url = "http://" + url

    query: list[tuple[str, str]] = []
    for param in request.params:
        if param.enabled and param.key.strip():
            query.append((param.key.strip(), param.value or ""))

    auth = request.auth
    if (
        auth
        and (auth.type or "").lower() == "apikey"
        and (auth.apiKeyIn or "").lower() == "query"
        and auth.apiKeyName
        and auth.apiKeyName.strip()
    ):
        query.append((auth.apiKeyName.strip(), auth.apiKeyValue or ""))

    if query:
        if url.endswith("?") or url.endswith("&"):
            separator = ""
        elif "?" in url:
            separator = "&"
        else:
            separator = "?"
        url = url + separator + urlencode(query, quote_via=quote)

    return url


def _apply_auth(headers: dict[str, str], auth: Auth | None) -> None:
    if not auth or not auth.type:
        return

    auth_type = auth.type.lower()
    if auth_type == "basic":
        raw = f"{auth.username or ''}:{auth.password or ''}".encode("utf-8")
        headers["Authorization"] = "Basic " + base64.b64encode(raw).decode("ascii")
    elif auth_type == "bearer":
        if auth.token and auth.token.strip():
            headers["Authorization"] = "Bearer " + auth.token.strip()
    elif auth_type == "apikey":
        if (
            auth.apiKeyName
            and auth.apiKeyName.strip()
            and (auth.apiKeyIn or "header").lower() != "query"
        ):
            headers[auth.apiKeyName.strip()] = auth.apiKeyValue or ""


def _prepare_body(body: RequestBody | None, headers: dict[str, str]) -> dict:
    if body is None:
        return {}

    body_type = (body.type or "none").lower()
    content = body.content or ""

    if body_type in ("none", ""):
        return {}

    if body_type == "json":
        _ensure_content_type(headers, "application/json; charset=UTF-8")
        return {"data": content.encode("utf-8")}

    if body_type == "xml":
        _ensure_content_type(headers, "application/xml; charset=UTF-8")
        return {"data": content.encode("utf-8")}

    if body_type == "text":
        _ensure_content_type(headers, "text/plain; charset=UTF-8")
        return {"data": content.encode("utf-8")}

    if body_type in ("form-urlencoded", "urlencoded"):
        _ensure_content_type(headers, "application/x-www-form-urlencoded; charset=UTF-8")
        pairs = [
            (field.key.strip(), field.value or "")
            for field in body.formFields
            if field.enabled and field.key.strip()
        ]
        return {"data": pairs if pairs else ""}

    if body_type in ("form-data", "multipart"):
        files = []
        for field in body.formFields:
            if not field.enabled or not field.key.strip():
                continue
            if field.type.lower() == "file":
                files.append(
                    (
                        field.key.strip(),
                        (
                            field.fileName or "file",
                            _decode_base64(field.fileBase64),
                            field.contentType or "application/octet-stream",
                        ),
                    )
                )
            else:
                files.append((field.key.strip(), (None, field.value or "")))
        return {"files": files} if files else {}

    _ensure_content_type(headers, "text/plain; charset=UTF-8")
    return {"data": content.encode("utf-8")}


def _ensure_content_type(headers: dict[str, str], value: str) -> None:
    if not any(name.lower() == "content-type" for name in headers):
        headers["Content-Type"] = value


def _decode_base64(value: str | None) -> bytes:
    if not value or not value.strip():
        return b""
    data = value.strip()
    if data.startswith("data:"):
        comma = data.find(",")
        if comma >= 0:
            data = data[comma + 1 :]
    try:
        return base64.b64decode(data, validate=False)
    except (ValueError, TypeError) as exc:
        raise ApiError(400, "Invalid base64 file content for multipart upload") from exc


def _is_binary(content_type: str) -> bool:
    if not content_type:
        return False
    lowered = content_type.lower()
    if lowered.startswith("text/"):
        return False
    return not any(marker in lowered for marker in TEXTUAL_MARKERS)


def _charset_of(content_type: str) -> str:
    match = CHARSET_RE.search(content_type or "")
    if not match:
        return "utf-8"
    charset = match.group(1)
    try:
        codecs.lookup(charset)
        return charset
    except LookupError:
        return "utf-8"


def _host_of(url: str) -> str:
    match = re.match(r"^[a-zA-Z][a-zA-Z0-9+.-]*://([^/?#]+)", url)
    return match.group(1) if match else url
