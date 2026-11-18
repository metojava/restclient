from pydantic import BaseModel, Field


class KeyValue(BaseModel):
    key: str = ""
    value: str = ""
    enabled: bool = True


class FormField(BaseModel):
    key: str = ""
    value: str = ""
    type: str = "text"
    fileName: str | None = None
    contentType: str | None = None
    fileBase64: str | None = None
    enabled: bool = True


class RequestBody(BaseModel):
    type: str = "none"
    content: str = ""
    formFields: list[FormField] = Field(default_factory=list)


class Auth(BaseModel):
    type: str = "none"
    username: str | None = None
    password: str | None = None
    token: str | None = None
    apiKeyName: str | None = None
    apiKeyValue: str | None = None
    apiKeyIn: str | None = None


class HttpRequestDto(BaseModel):
    method: str = "GET"
    url: str = ""
    params: list[KeyValue] = Field(default_factory=list)
    headers: list[KeyValue] = Field(default_factory=list)
    auth: Auth = Field(default_factory=Auth)
    body: RequestBody = Field(default_factory=RequestBody)
    timeoutMs: int | None = None
    followRedirects: bool | None = True
    disableTlsVerification: bool | None = False


class HeaderEntry(BaseModel):
    name: str
    value: str


class HttpResponseDto(BaseModel):
    status: int
    statusText: str
    body: str
    contentType: str
    binary: bool
    timeMs: int
    size: int
    headers: list[HeaderEntry]
