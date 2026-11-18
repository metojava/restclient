import type { AuthState, BodyState, BodyType, FormRow, RequestModel, RequestTab } from '../types';
import { tryPrettyJson } from '../utils';
import FormDataEditor from './FormDataEditor';
import * as Icon from './Icons';
import KeyValueEditor from './KeyValueEditor';

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];

const TABS: { id: RequestTab; label: string }[] = [
  { id: 'params', label: 'Params' },
  { id: 'headers', label: 'Headers' },
  { id: 'auth', label: 'Authorization' },
  { id: 'body', label: 'Body' },
];

const BODY_TYPES: { id: BodyType; label: string }[] = [
  { id: 'none', label: 'none' },
  { id: 'json', label: 'JSON' },
  { id: 'text', label: 'Text' },
  { id: 'xml', label: 'XML' },
  { id: 'form-urlencoded', label: 'Form URL Enc.' },
  { id: 'form-data', label: 'Multipart' },
];

const AUTH_TYPES: { id: AuthState['type']; label: string }[] = [
  { id: 'none', label: 'No auth' },
  { id: 'basic', label: 'Basic auth' },
  { id: 'bearer', label: 'Bearer token' },
  { id: 'apiKey', label: 'API key' },
];

interface Props {
  request: RequestModel;
  onChange: (updater: (request: RequestModel) => RequestModel) => void;
  onSend: () => void;
  onSave: () => void;
  onCopyCurl: () => void;
  loading: boolean;
  tab: RequestTab;
  onTabChange: (tab: RequestTab) => void;
}

export default function RequestPanel({
  request,
  onChange,
  onSend,
  onSave,
  onCopyCurl,
  loading,
  tab,
  onTabChange,
}: Props) {
  const set = (patch: Partial<RequestModel>) => onChange((current) => ({ ...current, ...patch }));
  const setAuth = (patch: Partial<AuthState>) =>
    onChange((current) => ({ ...current, auth: { ...current.auth, ...patch } }));
  const setBody = (patch: Partial<BodyState>) =>
    onChange((current) => ({ ...current, body: { ...current.body, ...patch } }));

  const activeCount = (rows: RequestModel['params']) =>
    rows.filter((row) => row.enabled && row.key.trim()).length;

  const badges: Record<RequestTab, string | null> = {
    params: activeCount(request.params) ? String(activeCount(request.params)) : null,
    headers: activeCount(request.headers) ? String(activeCount(request.headers)) : null,
    auth: request.auth.type !== 'none' ? 'on' : null,
    body: request.body.type !== 'none' ? 'on' : null,
  };

  const formatJson = () => {
    const pretty = tryPrettyJson(request.body.content);
    if (pretty) {
      setBody({ content: pretty });
    }
  };

  return (
    <section className="request-panel">
      <div className="url-bar">
        <select
          className={`method-select method-${request.method.toLowerCase()}`}
          value={request.method}
          onChange={(event) => set({ method: event.target.value })}
          title="HTTP method"
        >
          {METHODS.map((method) => (
            <option key={method} value={method}>
              {method}
            </option>
          ))}
        </select>

        <input
          className="url-input"
          value={request.url}
          placeholder="https://api.example.com/endpoint"
          spellCheck={false}
          onChange={(event) => set({ url: event.target.value })}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              onSend();
            }
          }}
        />

        <button className="btn btn-primary send-btn" onClick={onSend} disabled={loading}>
          {loading ? <span className="spinner" /> : <Icon.Send size={15} />}
          {loading ? 'Sending' : 'Send'}
        </button>
        <button className="btn icon-btn" title="Save request (Ctrl+S)" onClick={onSave}>
          <Icon.Bookmark size={16} />
        </button>
        <button className="btn icon-btn" title="Copy as cURL" onClick={onCopyCurl}>
          <Icon.Terminal size={16} />
        </button>
      </div>

      <div className="request-tabs" role="tablist">
        {TABS.map((entry) => (
          <button
            key={entry.id}
            role="tab"
            aria-selected={tab === entry.id}
            className={`tab${tab === entry.id ? ' active' : ''}`}
            onClick={() => onTabChange(entry.id)}
          >
            {entry.label}
            {badges[entry.id] && <span className="tab-badge">{badges[entry.id]}</span>}
          </button>
        ))}
        <span className="tabs-spacer" />
        <span className={`tls-flag${request.disableTls ? ' on' : ''}`} title="TLS verification setting">
          {request.disableTls ? 'TLS off' : 'TLS on'}
        </span>
      </div>

      <div className="request-editor">
        {tab === 'params' && (
          <>
            <p className="editor-hint">
              Query parameters are appended to the URL. Values are URL-encoded automatically.
            </p>
            <KeyValueEditor
              rows={request.params}
              onChange={(params) => set({ params })}
              keyPlaceholder="Parameter"
              valuePlaceholder="Value"
            />
          </>
        )}

        {tab === 'headers' && (
          <>
            <p className="editor-hint">
              Headers are sent with the request. Content-Type is added automatically for the body type
              unless you define it yourself.
            </p>
            <KeyValueEditor
              rows={request.headers}
              onChange={(headers) => set({ headers })}
              keyPlaceholder="Header"
              valuePlaceholder="Value"
            />
          </>
        )}

        {tab === 'auth' && (
          <div className="auth-editor">
            <div className="field-row">
              <label className="field">
                <span>Auth type</span>
                <select
                  value={request.auth.type}
                  onChange={(event) =>
                    setAuth({ type: event.target.value as AuthState['type'] })
                  }
                >
                  {AUTH_TYPES.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {request.auth.type === 'basic' && (
              <div className="field-row two">
                <label className="field">
                  <span>Username</span>
                  <input
                    value={request.auth.username}
                    autoComplete="off"
                    onChange={(event) => setAuth({ username: event.target.value })}
                  />
                </label>
                <label className="field">
                  <span>Password</span>
                  <input
                    type="password"
                    value={request.auth.password}
                    autoComplete="off"
                    onChange={(event) => setAuth({ password: event.target.value })}
                  />
                </label>
              </div>
            )}

            {request.auth.type === 'bearer' && (
              <div className="field-row">
                <label className="field">
                  <span>Token</span>
                  <input
                    value={request.auth.token}
                    placeholder="eyJhbGciOi..."
                    autoComplete="off"
                    onChange={(event) => setAuth({ token: event.target.value })}
                  />
                </label>
              </div>
            )}

            {request.auth.type === 'apiKey' && (
              <>
                <div className="field-row two">
                  <label className="field">
                    <span>Key name</span>
                    <input
                      value={request.auth.apiKeyName}
                      placeholder="X-API-Key"
                      onChange={(event) => setAuth({ apiKeyName: event.target.value })}
                    />
                  </label>
                  <label className="field">
                    <span>Key value</span>
                    <input
                      value={request.auth.apiKeyValue}
                      placeholder="secret-key"
                      onChange={(event) => setAuth({ apiKeyValue: event.target.value })}
                    />
                  </label>
                </div>
                <div className="field-row">
                  <label className="field">
                    <span>Add to</span>
                    <select
                      value={request.auth.apiKeyIn}
                      onChange={(event) =>
                        setAuth({ apiKeyIn: event.target.value === 'query' ? 'query' : 'header' })
                      }
                    >
                      <option value="header">Header</option>
                      <option value="query">Query parameter</option>
                    </select>
                  </label>
                </div>
              </>
            )}

            {request.auth.type === 'none' && (
              <p className="editor-hint">This request is sent without authorization credentials.</p>
            )}
          </div>
        )}

        {tab === 'body' && (
          <div className="body-editor">
            <div className="segmented">
              {BODY_TYPES.map((entry) => (
                <button
                  key={entry.id}
                  className={request.body.type === entry.id ? 'active' : ''}
                  onClick={() => setBody({ type: entry.id })}
                >
                  {entry.label}
                </button>
              ))}
            </div>

            {(request.body.type === 'json' ||
              request.body.type === 'text' ||
              request.body.type === 'xml') && (
              <div className="raw-body">
                <div className="raw-body-head">
                  <span>
                    Raw body
                    {request.body.type === 'json' && ' · application/json'}
                    {request.body.type === 'xml' && ' · application/xml'}
                    {request.body.type === 'text' && ' · text/plain'}
                  </span>
                  {request.body.type === 'json' && (
                    <button className="link-btn" onClick={formatJson}>
                      <Icon.Spark size={13} /> Beautify
                    </button>
                  )}
                </div>
                <textarea
                  className="code-area"
                  value={request.body.content}
                  spellCheck={false}
                  placeholder={
                    request.body.type === 'json'
                      ? '{\n  "name": "Ada",\n  "role": "engineer"\n}'
                      : 'Request body…'
                  }
                  onChange={(event) => setBody({ content: event.target.value })}
                />
              </div>
            )}

            {request.body.type === 'form-urlencoded' && (
              <>
                <p className="editor-hint">
                  Sent as application/x-www-form-urlencoded. Files are not supported with this type.
                </p>
                <KeyValueEditor
                  rows={request.body.formFields}
                  onChange={(formFields) => setBody({ formFields: formFields as FormRow[] })}
                  keyPlaceholder="Field"
                  valuePlaceholder="Value"
                />
              </>
            )}

            {request.body.type === 'form-data' && (
              <>
                <p className="editor-hint">
                  Sent as multipart/form-data. Pick “File” to attach a file from your computer.
                </p>
                <FormDataEditor
                  rows={request.body.formFields}
                  onChange={(formFields) => setBody({ formFields })}
                />
              </>
            )}

            {request.body.type === 'none' && (
              <div className="inline-empty">
                <Icon.Code size={18} />
                <span>This request has no body.</span>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="request-footer">
        <label className="inline-field">
          Timeout
          <input
            type="number"
            min={1}
            step={1000}
            value={request.timeoutMs}
            onChange={(event) =>
              set({ timeoutMs: Math.max(1, Number(event.target.value) || 30000) })
            }
          />
          <span className="muted">ms</span>
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={request.followRedirects}
            onChange={(event) => set({ followRedirects: event.target.checked })}
          />
          Follow redirects
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={request.disableTls}
            onChange={(event) => set({ disableTls: event.target.checked })}
          />
          Disable TLS verification
        </label>
        <span className="footer-spacer" />
        <span className="muted">Ctrl + Enter to send</span>
      </div>
    </section>
  );
}
