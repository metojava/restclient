import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from './api';
import * as Icon from './components/Icons';
import RequestPanel from './components/RequestPanel';
import ResponsePanel from './components/ResponsePanel';
import SaveModal from './components/SaveModal';
import Sidebar from './components/Sidebar';
import type {
  ApiResponse,
  Collection,
  HistoryEntry,
  RequestModel,
  RequestTab,
  ResponseTab,
  SavedRequest,
  SidebarTab,
} from './types';
import {
  copyText,
  defaultRequest,
  emptyFormRow,
  emptyRow,
  fromWire,
  parseVars,
  substituteRequest,
  toCurl,
  toWire,
} from './utils';

const DRAFT_KEY = 'restclient.draft.v1';
const VARS_KEY = 'restclient.vars.v1';

function loadDraft(): RequestModel {
  try {
    const stored = localStorage.getItem(DRAFT_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as Partial<RequestModel>;
      if (parsed && typeof parsed.url === 'string') {
        const base = defaultRequest();
        return {
          ...base,
          ...parsed,
          params: parsed.params?.length ? parsed.params : [emptyRow()],
          headers: parsed.headers?.length ? parsed.headers : [emptyRow()],
          auth: { ...base.auth, ...(parsed.auth ?? {}) },
          body: {
            ...base.body,
            ...(parsed.body ?? {}),
            formFields: parsed.body?.formFields?.length
              ? parsed.body.formFields
              : [emptyFormRow()],
          },
        };
      }
    }
  } catch {
    // ignore corrupt draft
  }
  return defaultRequest();
}

export default function App() {
  const [request, setRequest] = useState<RequestModel>(loadDraft);
  const [response, setResponse] = useState<ApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [requestTab, setRequestTab] = useState<RequestTab>('params');
  const [responseTab, setResponseTab] = useState<ResponseTab>('body');
  const [pretty, setPretty] = useState(true);
  const [wrap, setWrap] = useState(true);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('history');
  const [varsText, setVarsText] = useState(() => localStorage.getItem(VARS_KEY) ?? '');
  const [saveOpen, setSaveOpen] = useState(false);
  const [toast, setToast] = useState<{ message: string; kind: 'ok' | 'err' } | null>(null);
  const [online, setOnline] = useState(false);
  const toastTimer = useRef<number | undefined>(undefined);

  const variables = useMemo(() => parseVars(varsText), [varsText]);

  const showToast = useCallback((message: string, kind: 'ok' | 'err' = 'ok') => {
    setToast({ message, kind });
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 3200);
  }, []);

  useEffect(() => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(request));
  }, [request]);

  useEffect(() => {
    localStorage.setItem(VARS_KEY, varsText);
  }, [varsText]);

  const refreshHistory = useCallback(async () => {
    try {
      setHistory(await api.history());
    } catch {
      // backend offline; the status indicator covers this
    }
  }, []);

  const refreshCollections = useCallback(async () => {
    try {
      setCollections(await api.collections());
    } catch {
      // backend offline
    }
  }, []);

  useEffect(() => {
    refreshHistory();
    refreshCollections();
  }, [refreshHistory, refreshCollections]);

  useEffect(() => {
    let alive = true;
    const check = () => {
      api
        .health()
        .then(() => {
          if (alive) setOnline(true);
        })
        .catch(() => {
          if (alive) setOnline(false);
        });
    };
    check();
    const timer = window.setInterval(check, 15000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, []);

  const send = useCallback(async () => {
    if (loading) return;
    const target = substituteRequest(request, variables);
    if (!target.url.trim()) {
      setError('Enter a URL before sending.');
      setResponse(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await api.execute(toWire(target));
      setResponse(result);
      setResponseTab('body');
      await refreshHistory();
    } catch (err) {
      setResponse(null);
      setError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setLoading(false);
    }
  }, [loading, request, variables, refreshHistory]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const mod = event.ctrlKey || event.metaKey;
      if (mod && event.key === 'Enter') {
        event.preventDefault();
        send();
      }
      if (mod && event.key.toLowerCase() === 's') {
        event.preventDefault();
        setSaveOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [send]);

  const handleCopyCurl = async () => {
    const curl = toCurl(toWire(substituteRequest(request, variables)));
    const ok = await copyText(curl);
    showToast(ok ? 'cURL command copied' : 'Could not copy cURL', ok ? 'ok' : 'err');
  };

  const handleNew = () => {
    if (!window.confirm('Start a new request? The current draft will be replaced.')) {
      return;
    }
    setRequest(defaultRequest());
    setResponse(null);
    setError(null);
    setRequestTab('params');
  };

  const handleLoadHistory = (entry: HistoryEntry) => {
    setRequest(fromWire(entry.request));
    setResponse(null);
    setError(null);
    showToast('Loaded request from history');
  };

  const handleLoadSaved = (saved: SavedRequest) => {
    setRequest(fromWire(saved.request));
    setResponse(null);
    setError(null);
    showToast(`Loaded "${saved.name}"`);
  };

  const handleClearHistory = async () => {
    if (!window.confirm('Clear all request history?')) return;
    try {
      await api.clearHistory();
      setHistory([]);
      showToast('History cleared');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not clear history', 'err');
    }
  };

  const handleDeleteCollection = async (collection: Collection) => {
    if (!window.confirm(`Delete collection "${collection.name}" and all its requests?`)) return;
    try {
      await api.deleteCollection(collection.id);
      await refreshCollections();
      showToast('Collection deleted');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not delete collection', 'err');
    }
  };

  const handleDeleteSaved = async (collectionId: string, saved: SavedRequest) => {
    try {
      await api.deleteSavedRequest(collectionId, saved.id);
      await refreshCollections();
      showToast('Saved request deleted');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not delete request', 'err');
    }
  };

  const handleCreateCollection = async (name: string) => {
    await api.createCollection(name);
    await refreshCollections();
    showToast('Collection created');
  };

  const handleSaveRequest = async (target: {
    collectionId?: string;
    newCollection?: string;
    name: string;
  }) => {
    if (!request.url.trim()) {
      throw new Error('Enter a URL before saving this request.');
    }
    let collectionId = target.collectionId;
    if (!collectionId) {
      const created = await api.createCollection(target.newCollection || 'My collection');
      collectionId = created.id;
    }
    await api.saveRequest(collectionId, {
      name: target.name,
      request: toWire(substituteRequest(request, variables)),
    });
    await refreshCollections();
    setSidebarTab('saved');
    showToast('Request saved');
  };

  const defaultSaveName = useMemo(() => {
    const url = request.url.trim();
    if (!url) return `${request.method} request`;
    try {
      const parsed = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(url) ? url : `http://${url}`);
      const path = parsed.pathname === '/' ? parsed.host : parsed.pathname;
      return `${request.method} ${path}`;
    } catch {
      return `${request.method} ${url}`;
    }
  }, [request.method, request.url]);

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <div className="logo-mark">R</div>
          <div className="brand-text">
            <span className="brand-name">RestClient</span>
            <span className="brand-sub">HTTP playground</span>
          </div>
        </div>

        <div className="topbar-right">
          <span className={`online ${online ? 'on' : 'off'}`} title="Backend connection status">
            <span className="online-dot" />
            {online ? 'Backend online' : 'Backend offline'}
          </span>
          <button className="ghost-btn" onClick={handleNew} title="Start a new request">
            <Icon.Plus size={14} /> New
          </button>
        </div>
      </header>

      <div className="workspace">
        <Sidebar
          tab={sidebarTab}
          onTabChange={setSidebarTab}
          history={history}
          collections={collections}
          variablesText={varsText}
          varCount={Object.keys(variables).length}
          onVarsChange={setVarsText}
          onLoadHistory={handleLoadHistory}
          onClearHistory={handleClearHistory}
          onLoadSaved={handleLoadSaved}
          onDeleteCollection={handleDeleteCollection}
          onDeleteSaved={handleDeleteSaved}
          onCreateCollection={handleCreateCollection}
          onSaveRequest={() => setSaveOpen(true)}
        />

        <main className="main">
          <RequestPanel
            request={request}
            onChange={setRequest}
            onSend={send}
            onSave={() => setSaveOpen(true)}
            onCopyCurl={handleCopyCurl}
            loading={loading}
            tab={requestTab}
            onTabChange={setRequestTab}
          />

          <ResponsePanel
            response={response}
            error={error}
            loading={loading}
            tab={responseTab}
            onTabChange={setResponseTab}
            pretty={pretty}
            onPrettyChange={setPretty}
            wrap={wrap}
            onWrapChange={setWrap}
            onNotify={showToast}
          />
        </main>
      </div>

      {saveOpen && (
        <SaveModal
          collections={collections}
          defaultName={defaultSaveName}
          onClose={() => setSaveOpen(false)}
          onSubmit={handleSaveRequest}
        />
      )}

      {toast && (
        <div className={`toast ${toast.kind}`}>
          {toast.kind === 'ok' ? <Icon.Check size={15} /> : <Icon.Close size={15} />}
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
}
