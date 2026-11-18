package com.restclient.service;

import com.restclient.dto.FormField;
import com.restclient.dto.HeaderEntry;
import com.restclient.dto.HttpRequestDto;
import com.restclient.dto.HttpResponseDto;
import com.restclient.dto.KeyValue;
import com.restclient.dto.RequestBody;
import com.restclient.exception.ApiException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import javax.net.ssl.SSLContext;
import javax.net.ssl.TrustManager;
import javax.net.ssl.X509TrustManager;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.net.CookieManager;
import java.net.CookiePolicy;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.net.http.HttpTimeoutException;
import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.SecureRandom;
import java.security.cert.X509Certificate;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

@Service
public class HttpExecutionService {

    private static final Set<String> RESTRICTED_HEADERS = Set.of(
            "connection", "content-length", "expect", "host", "upgrade", "transfer-encoding");

    private static final Map<Integer, String> REASON_PHRASES = Map.ofEntries(
            Map.entry(100, "Continue"), Map.entry(101, "Switching Protocols"),
            Map.entry(200, "OK"), Map.entry(201, "Created"), Map.entry(202, "Accepted"),
            Map.entry(203, "Non-Authoritative Information"), Map.entry(204, "No Content"),
            Map.entry(205, "Reset Content"), Map.entry(206, "Partial Content"),
            Map.entry(300, "Multiple Choices"), Map.entry(301, "Moved Permanently"),
            Map.entry(302, "Found"), Map.entry(303, "See Other"), Map.entry(304, "Not Modified"),
            Map.entry(307, "Temporary Redirect"), Map.entry(308, "Permanent Redirect"),
            Map.entry(400, "Bad Request"), Map.entry(401, "Unauthorized"), Map.entry(402, "Payment Required"),
            Map.entry(403, "Forbidden"), Map.entry(404, "Not Found"), Map.entry(405, "Method Not Allowed"),
            Map.entry(406, "Not Acceptable"), Map.entry(408, "Request Timeout"), Map.entry(409, "Conflict"),
            Map.entry(410, "Gone"), Map.entry(411, "Length Required"), Map.entry(412, "Precondition Failed"),
            Map.entry(413, "Payload Too Large"), Map.entry(414, "URI Too Long"),
            Map.entry(415, "Unsupported Media Type"), Map.entry(422, "Unprocessable Entity"),
            Map.entry(425, "Too Early"), Map.entry(426, "Upgrade Required"), Map.entry(428, "Precondition Required"),
            Map.entry(429, "Too Many Requests"), Map.entry(431, "Request Header Fields Too Large"),
            Map.entry(451, "Unavailable For Legal Reasons"),
            Map.entry(500, "Internal Server Error"), Map.entry(501, "Not Implemented"),
            Map.entry(502, "Bad Gateway"), Map.entry(503, "Service Unavailable"),
            Map.entry(504, "Gateway Timeout"), Map.entry(505, "HTTP Version Not Supported"),
            Map.entry(511, "Network Authentication Required"));

    private final CookieManager cookieManager = new CookieManager(null, CookiePolicy.ACCEPT_ALL);
    private final SSLContext trustAllContext = buildTrustAllContext();

    public HttpResponseDto execute(HttpRequestDto request) {
        if (request == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Request payload is required");
        }

        String method = normalizeMethod(request.method());
        URI uri = buildUri(request.url(), safeList(request.params()), request.auth());
        List<HeaderEntry> headers = new ArrayList<>();
        for (KeyValue header : safeList(request.headers())) {
            if (header == null || !header.isOn()) {
                continue;
            }
            if (header.key() == null || header.key().isBlank()) {
                continue;
            }
            String name = header.key().trim();
            if (RESTRICTED_HEADERS.contains(name.toLowerCase(Locale.ROOT))) {
                continue;
            }
            headers.add(new HeaderEntry(name, header.value() == null ? "" : header.value()));
        }

        applyAuth(headers, request.auth());
        HttpRequest.BodyPublisher publisher = buildBody(headers, request.body());

        int timeoutMs = request.timeoutMs() == null ? 30_000 : request.timeoutMs();
        if (timeoutMs < 1) {
            timeoutMs = 30_000;
        }
        timeoutMs = Math.min(timeoutMs, 600_000);

        HttpClient.Builder clientBuilder = HttpClient.newBuilder()
                .connectTimeout(Duration.ofMillis(Math.min(timeoutMs, 15_000)))
                .followRedirects(Boolean.FALSE.equals(request.followRedirects())
                        ? HttpClient.Redirect.NEVER
                        : HttpClient.Redirect.NORMAL)
                .cookieHandler(cookieManager)
                .version(HttpClient.Version.HTTP_2);

        if (Boolean.TRUE.equals(request.disableTlsVerification())) {
            clientBuilder.sslContext(trustAllContext);
        }

        HttpRequest.Builder builder;
        try {
            builder = HttpRequest.newBuilder(uri)
                    .timeout(Duration.ofMillis(timeoutMs))
                    .method(method, publisher);
        } catch (IllegalArgumentException ex) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Invalid HTTP method or URL: " + ex.getMessage(), ex);
        }

        for (HeaderEntry header : headers) {
            try {
                builder.header(header.name(), header.value());
            } catch (IllegalArgumentException ex) {
                // Header not allowed by java.net.http; skip it rather than failing the whole request.
            }
        }

        HttpClient client = clientBuilder.build();
        long start = System.nanoTime();
        HttpResponse<byte[]> response;
        try {
            response = client.send(builder.build(), HttpResponse.BodyHandlers.ofByteArray());
        } catch (HttpTimeoutException ex) {
            throw new ApiException(HttpStatus.GATEWAY_TIMEOUT,
                    "Request timed out after " + timeoutMs + " ms", ex);
        } catch (java.net.ConnectException ex) {
            throw new ApiException(HttpStatus.BAD_GATEWAY,
                    "Could not connect to " + uri.getHost() + (uri.getPort() > 0 ? ":" + uri.getPort() : "")
                            + ". Is the server running?", ex);
        } catch (java.net.UnknownHostException ex) {
            throw new ApiException(HttpStatus.BAD_GATEWAY,
                    "Unknown host: " + uri.getHost(), ex);
        } catch (javax.net.ssl.SSLException ex) {
            throw new ApiException(HttpStatus.BAD_GATEWAY,
                    "TLS/SSL error: " + ex.getMessage() + ". Try enabling 'Disable TLS verification'.", ex);
        } catch (IOException ex) {
            throw new ApiException(HttpStatus.BAD_GATEWAY,
                    "Request failed: " + (ex.getMessage() == null ? ex.getClass().getSimpleName() : ex.getMessage()), ex);
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "Request interrupted", ex);
        }

        long timeMs = Duration.ofNanos(System.nanoTime() - start).toMillis();
        byte[] bytes = response.body() == null ? new byte[0] : response.body();
        String contentType = response.headers().firstValue("content-type").orElse("");
        boolean binary = isBinary(contentType);
        String bodyText = binary
                ? Base64.getEncoder().encodeToString(bytes)
                : new String(bytes, charsetOf(contentType));

        List<HeaderEntry> responseHeaders = new ArrayList<>();
        response.headers().map().forEach((name, values) -> {
            for (String value : values) {
                responseHeaders.add(new HeaderEntry(name, value));
            }
        });

        return new HttpResponseDto(
                response.statusCode(),
                reasonPhrase(response.statusCode()),
                bodyText,
                contentType,
                binary,
                timeMs,
                bytes.length,
                responseHeaders);
    }

    private String normalizeMethod(String method) {
        String value = method == null || method.isBlank() ? "GET" : method.trim().toUpperCase(Locale.ROOT);
        if (!value.matches("[A-Z]+")) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Invalid HTTP method: " + method);
        }
        return value;
    }

    private URI buildUri(String rawUrl, List<KeyValue> params, com.restclient.dto.Auth auth) {
        if (rawUrl == null || rawUrl.isBlank()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "URL is required");
        }
        String url = rawUrl.trim();
        if (!url.matches("(?i)^[a-z][a-z0-9+.-]*://.*")) {
            url = "http://" + url;
        }

        List<String> query = new ArrayList<>();
        for (KeyValue param : params) {
            if (param == null || !param.isOn() || param.key() == null || param.key().isBlank()) {
                continue;
            }
            query.add(encode(param.key()) + "=" + encode(param.value() == null ? "" : param.value()));
        }

        if (auth != null && "apikey".equalsIgnoreCase(auth.type())
                && "query".equalsIgnoreCase(auth.apiKeyIn())
                && auth.apiKeyName() != null && !auth.apiKeyName().isBlank()) {
            query.add(encode(auth.apiKeyName()) + "=" + encode(auth.apiKeyValue() == null ? "" : auth.apiKeyValue()));
        }

        if (!query.isEmpty()) {
            if (!url.contains("?")) {
                url = url + "?";
            } else if (!url.endsWith("?") && !url.endsWith("&")) {
                url = url + "&";
            }
            url = url + String.join("&", query);
        }

        try {
            return URI.create(url.replace(" ", "%20"));
        } catch (IllegalArgumentException ex) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Invalid URL: " + rawUrl, ex);
        }
    }

    private void applyAuth(List<HeaderEntry> headers, com.restclient.dto.Auth auth) {
        if (auth == null || auth.type() == null) {
            return;
        }
        switch (auth.type().toLowerCase(Locale.ROOT)) {
            case "basic" -> {
                String raw = (auth.username() == null ? "" : auth.username())
                        + ":" + (auth.password() == null ? "" : auth.password());
                headers.add(new HeaderEntry("Authorization",
                        "Basic " + Base64.getEncoder().encodeToString(raw.getBytes(StandardCharsets.UTF_8))));
            }
            case "bearer" -> {
                if (auth.token() != null && !auth.token().isBlank()) {
                    headers.add(new HeaderEntry("Authorization", "Bearer " + auth.token().trim()));
                }
            }
            case "apikey" -> {
                if (auth.apiKeyName() != null && !auth.apiKeyName().isBlank()
                        && !"query".equalsIgnoreCase(auth.apiKeyIn())) {
                    headers.add(new HeaderEntry(auth.apiKeyName().trim(),
                            auth.apiKeyValue() == null ? "" : auth.apiKeyValue()));
                }
            }
            default -> {
                // none / unknown: nothing to add
            }
        }
    }

    private HttpRequest.BodyPublisher buildBody(List<HeaderEntry> headers, RequestBody body) {
        String type = body == null || body.type() == null ? "none" : body.type().toLowerCase(Locale.ROOT);
        String content = body == null || body.content() == null ? "" : body.content();

        switch (type) {
            case "none", "":
                return HttpRequest.BodyPublishers.noBody();
            case "json":
                ensureContentType(headers, "application/json; charset=UTF-8");
                return HttpRequest.BodyPublishers.ofString(content, StandardCharsets.UTF_8);
            case "xml":
                ensureContentType(headers, "application/xml; charset=UTF-8");
                return HttpRequest.BodyPublishers.ofString(content, StandardCharsets.UTF_8);
            case "text":
                ensureContentType(headers, "text/plain; charset=UTF-8");
                return HttpRequest.BodyPublishers.ofString(content, StandardCharsets.UTF_8);
            case "form-urlencoded", "urlencoded", "form-url-multipart":
                ensureContentType(headers, "application/x-www-form-urlencoded; charset=UTF-8");
                return HttpRequest.BodyPublishers.ofString(encodeForm(body == null ? null : body.formFields()),
                        StandardCharsets.UTF_8);
            case "form-data", "multipart":
                return buildMultipart(headers, body == null ? null : body.formFields());
            default:
                ensureContentType(headers, "text/plain; charset=UTF-8");
                return HttpRequest.BodyPublishers.ofString(content, StandardCharsets.UTF_8);
        }
    }

    private String encodeForm(List<FormField> fields) {
        List<String> parts = new ArrayList<>();
        for (FormField field : safeList(fields)) {
            if (field == null || !field.isOn() || field.key() == null || field.key().isBlank()) {
                continue;
            }
            parts.add(encode(field.key()) + "=" + encode(field.value() == null ? "" : field.value()));
        }
        return String.join("&", parts);
    }

    private HttpRequest.BodyPublisher buildMultipart(List<HeaderEntry> headers, List<FormField> fields) {
        String boundary = "----RestClientBoundary" + UUID.randomUUID().toString().replace("-", "");
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        try {
            for (FormField field : safeList(fields)) {
                if (field == null || !field.isOn() || field.key() == null || field.key().isBlank()) {
                    continue;
                }
                out.write(("--" + boundary + "\r\n").getBytes(StandardCharsets.UTF_8));
                boolean file = field.isFile();
                String filename = file
                        ? (field.fileName() == null || field.fileName().isBlank() ? "file" : field.fileName())
                        : null;
                String disposition = "Content-Disposition: form-data; name=\"" + escapeMultipart(field.key()) + "\""
                        + (file ? "; filename=\"" + escapeMultipart(filename) + "\"" : "")
                        + "\r\n";
                out.write(disposition.getBytes(StandardCharsets.UTF_8));

                if (file) {
                    String contentType = field.contentType() == null || field.contentType().isBlank()
                            ? "application/octet-stream"
                            : field.contentType();
                    out.write(("Content-Type: " + contentType + "\r\n\r\n").getBytes(StandardCharsets.UTF_8));
                    out.write(decodeBase64(field.fileBase64()));
                    out.write("\r\n".getBytes(StandardCharsets.UTF_8));
                } else {
                    out.write("\r\n".getBytes(StandardCharsets.UTF_8));
                    out.write((field.value() == null ? "" : field.value()).getBytes(StandardCharsets.UTF_8));
                    out.write("\r\n".getBytes(StandardCharsets.UTF_8));
                }
            }
            out.write(("--" + boundary + "--\r\n").getBytes(StandardCharsets.UTF_8));
        } catch (IOException ex) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Could not build multipart body", ex);
        }

        ensureContentType(headers, "multipart/form-data; boundary=" + boundary);
        return HttpRequest.BodyPublishers.ofByteArray(out.toByteArray());
    }

    private byte[] decodeBase64(String value) {
        if (value == null || value.isBlank()) {
            return new byte[0];
        }
        String data = value;
        int comma = data.indexOf(',');
        if (data.startsWith("data:") && comma > 0) {
            data = data.substring(comma + 1);
        }
        try {
            return Base64.getMimeDecoder().decode(data);
        } catch (IllegalArgumentException ex) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Invalid base64 file content for multipart upload", ex);
        }
    }

    private void ensureContentType(List<HeaderEntry> headers, String value) {
        boolean present = headers.stream()
                .anyMatch(h -> h.name().equalsIgnoreCase("content-type"));
        if (!present) {
            headers.add(new HeaderEntry("Content-Type", value));
        }
    }

    private boolean isBinary(String contentType) {
        if (contentType == null || contentType.isBlank()) {
            return false;
        }
        String type = contentType.toLowerCase(Locale.ROOT);
        if (type.startsWith("text/")) {
            return false;
        }
        String[] textual = {"json", "xml", "javascript", "ecmascript", "x-www-form-urlencoded",
                "graphql", "yaml", "yml", "csv", "html", "xhtml", "svg", "problem+json", "ld+json"};
        for (String marker : textual) {
            if (type.contains(marker)) {
                return false;
            }
        }
        return true;
    }

    private Charset charsetOf(String contentType) {
        if (contentType == null) {
            return StandardCharsets.UTF_8;
        }
        for (String part : contentType.split(";")) {
            String trimmed = part.trim();
            if (trimmed.toLowerCase(Locale.ROOT).startsWith("charset=")) {
                String charset = trimmed.substring("charset=".length()).replace("\"", "").trim();
                try {
                    return Charset.forName(charset);
                } catch (Exception ignored) {
                    return StandardCharsets.UTF_8;
                }
            }
        }
        return StandardCharsets.UTF_8;
    }

    private String reasonPhrase(int status) {
        return REASON_PHRASES.getOrDefault(status, "");
    }

    private String encode(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8).replace("+", "%20");
    }

    private String escapeMultipart(String value) {
        return value.replace("\"", "%22").replace("\r", "").replace("\n", "");
    }

    private SSLContext buildTrustAllContext() {
        try {
            TrustManager[] trustAll = new TrustManager[]{
                    new X509TrustManager() {
                        @Override
                        public void checkClientTrusted(X509Certificate[] chain, String authType) {
                        }

                        @Override
                        public void checkServerTrusted(X509Certificate[] chain, String authType) {
                        }

                        @Override
                        public X509Certificate[] getAcceptedIssuers() {
                            return new X509Certificate[0];
                        }
                    }
            };
            SSLContext context = SSLContext.getInstance("TLS");
            context.init(null, trustAll, new SecureRandom());
            return context;
        } catch (GeneralSecurityException ex) {
            throw new IllegalStateException("Could not initialise a permissive SSL context", ex);
        }
    }

    private <T> List<T> safeList(List<T> list) {
        return list == null ? List.of() : list.stream().filter(Objects::nonNull).toList();
    }
}
