import { useMemo } from 'react';
import type { ApiResponse, ResponseTab } from '../types';
import { copyText, fileExtension, formatBytes, statusClass, tryPrettyJson } from '../utils';
import * as Icon from './Icons';

interface Props {
  response: ApiResponse | null;
  error: string | null;
  loading: boolean;
  tab: ResponseTab;
  onTabChange: (tab: ResponseTab) => void;
  pretty: boolean;
  onPrettyChange: (value: boolean) => void;
  wrap: boolean;
  onWrapChange: (value: boolean) => void;
  onNotify: (message: string, kind?: 'ok' | 'err') => void;
}

export default function ResponsePanel({
  response,
  error,
  loading,
  tab,
  onTabChange,
  pretty,
  onPrettyChange,
  wrap,
  onWrapChange,
  onNotify,
}: Props) {
  const displayBody = useMemo(() => {
    if (!response) return '';
    if (response.binary) return response.body;
    if (pretty) {
      return tryPrettyJson(response.body) ?? response.body;
    }
    return response.body;
  }, [response, pretty]);

  const jsonLike = useMemo(
    () => !!response && !response.binary && tryPrettyJson(response.body) !== null,
    [response],
  );

  const isImage = !!response?.binary && response.contentType.toLowerCase().startsWith('image/');

  const copyBody = async () => {
    if (!response) return;
    const ok = await copyText(displayBody);
    onNotify(ok ? 'Response body copied' : 'Could not copy response', ok ? 'ok' : 'err');
  };

  const copyHeaders = async () => {
    if (!response) return;
    const text = response.headers.map((header) => `${header.name}: ${header.value}`).join('\n');
    const ok = await copyText(text);
    onNotify(ok ? 'Response headers copied' : 'Could not copy headers', ok ? 'ok' : 'err');
  };

  const download = () => {
    if (!response) return;
    const bytes = response.binary
      ? Uint8Array.from(atob(response.body), (char) => char.charCodeAt(0))
      : new TextEncoder().encode(response.body);
    const blob = new Blob([bytes], { type: response.contentType || 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `response.${fileExtension(response.contentType)}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <section className="response-panel">
      <div className="panel-head">
        <div className="panel-title">
          Response
          {response && (
            <span className={`status-pill ${statusClass(response.status)}`}>
              {response.status} {response.statusText}
            </span>
          )}
        </div>

        {response && (
          <div className="response-meta">
            <span className="meta-item">
              <Icon.Clock size={13} /> {response.timeMs} ms
            </span>
            <span className="meta-item">{formatBytes(response.size)}</span>
            <span className="meta-item">{response.headers.length} headers</span>
          </div>
        )}

        <div className="panel-actions">
          {response && (
            <>
              <button className="ghost-btn" onClick={copyBody} title="Copy response body">
                <Icon.Copy size={14} /> Copy
              </button>
              <button className="ghost-btn" onClick={download} title="Download response">
                <Icon.Download size={14} /> Download
              </button>
            </>
          )}
        </div>
      </div>

      {loading && (
        <div className="state-box">
          <span className="spinner large" />
          <span>Sending request…</span>
        </div>
      )}

      {!loading && error && (
        <div className="error-box">
          <span className="error-title">
            <Icon.Close size={15} /> Request failed
          </span>
          <span className="error-message">{error}</span>
        </div>
      )}

      {!loading && !error && !response && (
        <div className="state-box empty-state">
          <div className="empty-icon">
            <Icon.Send size={22} />
          </div>
          <span className="empty-title">Ready when you are</span>
          <span className="empty-sub">
            Enter a URL and press <kbd>Send</kbd> — the response will show up here.
          </span>
        </div>
      )}

      {!loading && !error && response && (
        <>
          <div className="response-tabs">
            <button
              className={`tab${tab === 'body' ? ' active' : ''}`}
              onClick={() => onTabChange('body')}
            >
              Body
            </button>
            <button
              className={`tab${tab === 'headers' ? ' active' : ''}`}
              onClick={() => onTabChange('headers')}
            >
              Headers
              <span className="tab-badge">{response.headers.length}</span>
            </button>
            <span className="tabs-spacer" />
            {response.contentType && (
              <span className="content-type" title={response.contentType}>
                {response.contentType}
              </span>
            )}
          </div>

          {tab === 'body' && (
            <div className="response-body">
              <div className="body-toolbar">
                {jsonLike && (
                  <label className="check">
                    <input
                      type="checkbox"
                      checked={pretty}
                      onChange={(event) => onPrettyChange(event.target.checked)}
                    />
                    Pretty print
                  </label>
                )}
                <label className="check">
                  <input
                    type="checkbox"
                    checked={wrap}
                    onChange={(event) => onWrapChange(event.target.checked)}
                  />
                  Wrap lines
                </label>
              </div>

              {isImage ? (
                <div className="image-preview">
                  <img
                    src={`data:${response.contentType};base64,${response.body}`}
                    alt="Response preview"
                  />
                </div>
              ) : response.binary ? (
                <div className="binary-box">
                  <Icon.Download size={20} />
                  <span>Binary response ({formatBytes(response.size)})</span>
                  <button className="btn" onClick={download}>
                    Download file
                  </button>
                </div>
              ) : response.body.length === 0 ? (
                <div className="state-box small">
                  <span className="muted">The response body is empty.</span>
                </div>
              ) : (
                <pre className={`response-text${wrap ? ' wrap' : ''}`}>{displayBody}</pre>
              )}
            </div>
          )}

          {tab === 'headers' && (
            <div className="response-body">
              <div className="body-toolbar">
                <span className="muted">Response headers</span>
                <button className="link-btn" onClick={copyHeaders}>
                  <Icon.Copy size={13} /> Copy all
                </button>
              </div>
              <div className="headers-table">
                {response.headers.map((header, index) => (
                  <div className="header-row" key={`${header.name}-${index}`}>
                    <span className="header-name">{header.name}</span>
                    <span className="header-value">{header.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
