import type {
  AuthState,
  BodyType,
  FormRow,
  KeyValueRow,
  RequestModel,
  WireFormField,
  WireRequest,
} from './types';

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

export const emptyRow = (): KeyValueRow => ({ id: uid(), key: '', value: '', enabled: true });

export const emptyFormRow = (): FormRow => ({
  id: uid(),
  key: '',
  value: '',
  enabled: true,
  fieldType: 'text',
});

export function defaultAuth(): AuthState {
  return {
    type: 'none',
    username: '',
    password: '',
    token: '',
    apiKeyName: '',
    apiKeyValue: '',
    apiKeyIn: 'header',
  };
}

export function defaultRequest(): RequestModel {
  return {
    method: 'GET',
    url: 'https://httpbin.org/get',
    params: [emptyRow()],
    headers: [emptyRow()],
    auth: defaultAuth(),
    body: { type: 'none', content: '', formFields: [emptyFormRow()] },
    timeoutMs: 30000,
    followRedirects: true,
    disableTls: false,
  };
}

const BODY_TYPES: BodyType[] = ['none', 'json', 'text', 'xml', 'form-urlencoded', 'form-data'];
const AUTH_TYPES = ['none', 'basic', 'bearer', 'apiKey'] as const;

export function toWire(req: RequestModel): WireRequest {
  return {
    method: req.method,
    url: req.url,
    params: req.params.map((row) => ({ key: row.key, value: row.value, enabled: row.enabled })),
    headers: req.headers.map((row) => ({ key: row.key, value: row.value, enabled: row.enabled })),
    auth: {
      type: req.auth.type,
      username: req.auth.username,
      password: req.auth.password,
      token: req.auth.token,
      apiKeyName: req.auth.apiKeyName,
      apiKeyValue: req.auth.apiKeyValue,
      apiKeyIn: req.auth.apiKeyIn,
    },
    body: {
      type: req.body.type,
      content: req.body.content,
      formFields: req.body.formFields.map<WireFormField>((row) => ({
        key: row.key,
        value: row.value,
        type: row.fieldType,
        fileName: row.fileName,
        contentType: row.contentType,
        fileBase64: row.fileBase64,
        enabled: row.enabled,
      })),
    },
    timeoutMs: req.timeoutMs,
    followRedirects: req.followRedirects,
    disableTlsVerification: req.disableTls,
  };
}

export function fromWire(wire: WireRequest | null | undefined): RequestModel {
  const base = defaultRequest();
  if (!wire) {
    return base;
  }
  const rows = (list: { key?: string; value?: string; enabled?: boolean }[] | undefined, form: boolean) => {
    const mapped = (list ?? []).map((row) =>
      form
        ? {
            ...emptyFormRow(),
            key: row.key ?? '',
            value: row.value ?? '',
            enabled: row.enabled !== false,
            fieldType: (row as WireFormField).type === 'file' ? 'file' : 'text',
            fileName: (row as WireFormField).fileName,
            contentType: (row as WireFormField).contentType,
            fileBase64: (row as WireFormField).fileBase64,
          }
        : {
            ...emptyRow(),
            key: row.key ?? '',
            value: row.value ?? '',
            enabled: row.enabled !== false,
          },
    ) as (KeyValueRow | FormRow)[];
    return mapped.length ? mapped : [form ? emptyFormRow() : emptyRow()];
  };

  const bodyType = BODY_TYPES.includes((wire.body?.type ?? 'none') as BodyType)
    ? ((wire.body?.type ?? 'none') as BodyType)
    : 'none';
  const authType = AUTH_TYPES.includes((wire.auth?.type ?? 'none') as (typeof AUTH_TYPES)[number])
    ? ((wire.auth?.type ?? 'none') as AuthState['type'])
    : 'none';

  return {
    method: wire.method || 'GET',
    url: wire.url || '',
    params: rows(wire.params, false) as KeyValueRow[],
    headers: rows(wire.headers, false) as KeyValueRow[],
    auth: {
      type: authType,
      username: wire.auth?.username ?? '',
      password: wire.auth?.password ?? '',
      token: wire.auth?.token ?? '',
      apiKeyName: wire.auth?.apiKeyName ?? '',
      apiKeyValue: wire.auth?.apiKeyValue ?? '',
      apiKeyIn: wire.auth?.apiKeyIn === 'query' ? 'query' : 'header',
    },
    body: {
      type: bodyType,
      content: wire.body?.content ?? '',
      formFields: rows(wire.body?.formFields, true) as FormRow[],
    },
    timeoutMs: wire.timeoutMs ?? 30000,
    followRedirects: wire.followRedirects !== false,
    disableTls: wire.disableTlsVerification === true,
  };
}

export function parseVars(text: string): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#') || line.startsWith('//')) {
      continue;
    }
    const index = line.indexOf('=');
    if (index <= 0) {
      continue;
    }
    const key = line.slice(0, index).trim();
    if (key) {
      vars[key] = line.slice(index + 1).trim();
    }
  }
  return vars;
}

export function substituteString(value: string, vars: Record<string, string>): string {
  return value.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (match, key: string) =>
    Object.prototype.hasOwnProperty.call(vars, key) ? vars[key] : match,
  );
}

export function substituteRequest(req: RequestModel, vars: Record<string, string>): RequestModel {
  const s = (value: string) => substituteString(value ?? '', vars);
  return {
    ...req,
    url: s(req.url),
    params: req.params.map((row) => ({ ...row, key: s(row.key), value: s(row.value) })),
    headers: req.headers.map((row) => ({ ...row, key: s(row.key), value: s(row.value) })),
    auth: {
      ...req.auth,
      username: s(req.auth.username),
      password: s(req.auth.password),
      token: s(req.auth.token),
      apiKeyName: s(req.auth.apiKeyName),
      apiKeyValue: s(req.auth.apiKeyValue),
    },
    body: {
      ...req.body,
      content: s(req.body.content),
      formFields: req.body.formFields.map((row) => ({
        ...row,
        key: s(row.key),
        value: s(row.value),
      })),
    },
  };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function timeAgo(timestamp: number): string {
  const seconds = Math.max(1, Math.floor((Date.now() - timestamp) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function statusClass(status: number): string {
  return `s${Math.floor(status / 100)}`;
}

export function shortUrl(url: string): string {
  return url.replace(/^https?:\/\//i, '');
}

export function tryPrettyJson(body: string): string | null {
  try {
    return JSON.stringify(JSON.parse(body), null, 2);
  } catch {
    return null;
  }
}

export function fileExtension(contentType: string): string {
  const type = (contentType || '').toLowerCase();
  if (type.includes('json')) return 'json';
  if (type.includes('html')) return 'html';
  if (type.includes('xml')) return 'xml';
  if (type.includes('css')) return 'css';
  if (type.includes('javascript')) return 'js';
  if (type.includes('csv')) return 'csv';
  if (type.startsWith('image/png')) return 'png';
  if (type.startsWith('image/jpeg')) return 'jpg';
  if (type.startsWith('image/gif')) return 'gif';
  if (type.startsWith('image/webp')) return 'webp';
  if (type.startsWith('image/svg')) return 'svg';
  if (type.startsWith('text/')) return 'txt';
  return 'bin';
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

export function toCurl(wire: WireRequest): string {
  let url = (wire.url || '').trim();
  if (url && !/^[a-z][a-z0-9+.-]*:\/\//i.test(url)) {
    url = 'http://' + url;
  }

  const query: string[] = [];
  for (const param of wire.params ?? []) {
    if (param.enabled === false || !param.key?.trim()) continue;
    query.push(`${encodeURIComponent(param.key)}=${encodeURIComponent(param.value ?? '')}`);
  }
  const auth = wire.auth;
  if (auth?.type === 'apiKey' && auth.apiKeyIn === 'query' && auth.apiKeyName) {
    query.push(`${encodeURIComponent(auth.apiKeyName)}=${encodeURIComponent(auth.apiKeyValue ?? '')}`);
  }
  if (query.length) {
    url += (url.includes('?') ? (url.endsWith('?') || url.endsWith('&') ? '' : '&') : '?') + query.join('&');
  }

  const lines = [`curl -X ${wire.method || 'GET'} ${shellQuote(url)}`];

  for (const header of wire.headers ?? []) {
    if (header.enabled === false || !header.key?.trim()) continue;
    lines.push(`  -H ${shellQuote(`${header.key}: ${header.value ?? ''}`)}`);
  }

  const hasContentType = (wire.headers ?? []).some(
    (h) => h.enabled !== false && h.key?.toLowerCase() === 'content-type',
  );

  if (auth?.type === 'basic') {
    lines.push(`  -u ${shellQuote(`${auth.username ?? ''}:${auth.password ?? ''}`)}`);
  } else if (auth?.type === 'bearer' && auth.token) {
    lines.push(`  -H ${shellQuote(`Authorization: Bearer ${auth.token}`)}`);
  } else if (auth?.type === 'apiKey' && auth.apiKeyIn !== 'query' && auth.apiKeyName) {
    lines.push(`  -H ${shellQuote(`${auth.apiKeyName}: ${auth.apiKeyValue ?? ''}`)}`);
  }

  const body = wire.body;
  if (body && body.type !== 'none') {
    if (body.type === 'form-data') {
      for (const field of body.formFields ?? []) {
        if (field.enabled === false || !field.key?.trim()) continue;
        if (field.type === 'file') {
          const file = field.fileName || 'file';
          lines.push(`  -F ${shellQuote(`${field.key}=@${file}${field.contentType ? `;type=${field.contentType}` : ''}`)}`);
        } else {
          lines.push(`  -F ${shellQuote(`${field.key}=${field.value ?? ''}`)}`);
        }
      }
    } else if (body.type === 'form-urlencoded') {
      if (!hasContentType) {
        lines.push(`  -H ${shellQuote('Content-Type: application/x-www-form-urlencoded')}`);
      }
      for (const field of body.formFields ?? []) {
        if (field.enabled === false || !field.key?.trim()) continue;
        lines.push(`  --data-urlencode ${shellQuote(`${field.key}=${field.value ?? ''}`)}`);
      }
    } else {
      const defaultType =
        body.type === 'json'
          ? 'application/json'
          : body.type === 'xml'
            ? 'application/xml'
            : 'text/plain';
      if (!hasContentType) {
        lines.push(`  -H ${shellQuote(`Content-Type: ${defaultType}`)}`);
      }
      lines.push(`  --data-raw ${shellQuote(body.content ?? '')}`);
    }
  }

  return lines.join(' \\\n');
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const area = document.createElement('textarea');
      area.value = text;
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      document.execCommand('copy');
      document.body.removeChild(area);
      return true;
    } catch {
      return false;
    }
  }
}
