import { useMemo, useState } from 'react';
import type { Collection, HistoryEntry, SavedRequest, SidebarTab } from '../types';
import { formatBytes, shortUrl, statusClass, timeAgo } from '../utils';
import * as Icon from './Icons';

interface Props {
  tab: SidebarTab;
  onTabChange: (tab: SidebarTab) => void;
  history: HistoryEntry[];
  collections: Collection[];
  variablesText: string;
  varCount: number;
  onVarsChange: (text: string) => void;
  onLoadHistory: (entry: HistoryEntry) => void;
  onClearHistory: () => void;
  onLoadSaved: (saved: SavedRequest) => void;
  onDeleteCollection: (collection: Collection) => void;
  onDeleteSaved: (collectionId: string, saved: SavedRequest) => void;
  onCreateCollection: (name: string) => Promise<void>;
  onSaveRequest: () => void;
}

export default function Sidebar({
  tab,
  onTabChange,
  history,
  collections,
  variablesText,
  varCount,
  onVarsChange,
  onLoadHistory,
  onClearHistory,
  onLoadSaved,
  onDeleteCollection,
  onDeleteSaved,
  onCreateCollection,
  onSaveRequest,
}: Props) {
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [createBusy, setCreateBusy] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [showVars, setShowVars] = useState(false);

  const needle = search.trim().toLowerCase();

  const visibleHistory = useMemo(
    () =>
      history.filter((entry) =>
        !needle
          ? true
          : `${entry.request.method} ${entry.request.url} ${entry.status}`
              .toLowerCase()
              .includes(needle),
      ),
    [history, needle],
  );

  const visibleCollections = useMemo(
    () =>
      collections
        .map((collection) => ({
          ...collection,
          requests: collection.requests.filter((saved) =>
            !needle
              ? true
              : `${saved.name} ${saved.request.method} ${saved.request.url}`
                  .toLowerCase()
                  .includes(needle),
          ),
        }))
        .filter(
          (collection) =>
            !needle ||
            collection.requests.length > 0 ||
            collection.name.toLowerCase().includes(needle),
        ),
    [collections, needle],
  );

  const submitCollection = async () => {
    const name = newName.trim();
    if (!name) return;
    setCreateBusy(true);
    setCreateError(null);
    try {
      await onCreateCollection(name);
      setNewName('');
      setCreating(false);
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : 'Could not create collection');
    } finally {
      setCreateBusy(false);
    }
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-tabs">
        <button
          className={`sidebar-tab${tab === 'history' ? ' active' : ''}`}
          onClick={() => onTabChange('history')}
        >
          <Icon.Clock size={14} /> History
        </button>
        <button
          className={`sidebar-tab${tab === 'saved' ? ' active' : ''}`}
          onClick={() => onTabChange('saved')}
        >
          <Icon.Folder size={14} /> Saved
        </button>
      </div>

      <div className="sidebar-search">
        <Icon.Search size={14} />
        <input
          value={search}
          placeholder={tab === 'history' ? 'Filter history' : 'Filter saved requests'}
          onChange={(event) => setSearch(event.target.value)}
        />
        {search && (
          <button className="icon-btn subtle" onClick={() => setSearch('')} title="Clear filter">
            <Icon.Close size={12} />
          </button>
        )}
      </div>

      <div className="sidebar-scroll">
        {tab === 'history' && (
          <>
            <div className="list-head">
              <span>Recent requests</span>
              {history.length > 0 && (
                <button className="link-btn danger" onClick={onClearHistory}>
                  <Icon.Trash size={12} /> Clear
                </button>
              )}
            </div>

            {visibleHistory.length === 0 ? (
              <div className="sidebar-empty">
                <Icon.Clock size={18} />
                <span>{history.length === 0 ? 'No requests yet' : 'No matches'}</span>
                <span className="muted">
                  {history.length === 0 ? 'Sent requests will appear here.' : 'Try another filter.'}
                </span>
              </div>
            ) : (
              visibleHistory.map((entry) => (
                <button
                  className="history-item"
                  key={entry.id}
                  onClick={() => onLoadHistory(entry)}
                  title={entry.request.url}
                >
                  <span className={`method-tag ${(entry.request.method || 'GET').toLowerCase()}`}>
                    {entry.request.method || 'GET'}
                  </span>
                  <span className="item-main">
                    <span className="item-url">{shortUrl(entry.request.url || '')}</span>
                    <span className="item-sub">
                      {timeAgo(entry.timestamp)} · {formatBytes(entry.size)}
                    </span>
                  </span>
                  <span className={`mini-status ${statusClass(entry.status)}`}>{entry.status}</span>
                </button>
              ))
            )}
          </>
        )}

        {tab === 'saved' && (
          <>
            <div className="list-head">
              <span>Collections</span>
              <button
                className="link-btn"
                onClick={() => {
                  setCreating(true);
                  setCreateError(null);
                }}
              >
                <Icon.Plus size={12} /> New
              </button>
            </div>

            {creating && (
              <div className="new-collection">
                <input
                  autoFocus
                  value={newName}
                  placeholder="Collection name"
                  onChange={(event) => setNewName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') submitCollection();
                    if (event.key === 'Escape') setCreating(false);
                  }}
                />
                <button
                  className="icon-btn"
                  onClick={submitCollection}
                  disabled={createBusy}
                  title="Create collection"
                >
                  <Icon.Check size={14} />
                </button>
                <button className="icon-btn subtle" onClick={() => setCreating(false)} title="Cancel">
                  <Icon.Close size={14} />
                </button>
                {createError && <span className="inline-error">{createError}</span>}
              </div>
            )}

            {visibleCollections.length === 0 && !creating && (
              <div className="sidebar-empty">
                <Icon.Folder size={18} />
                <span>No saved requests</span>
                <span className="muted">Save a request to reuse it later.</span>
                <button className="btn small" onClick={onSaveRequest}>
                  <Icon.Bookmark size={13} /> Save current request
                </button>
              </div>
            )}

            {visibleCollections.map((collection) => (
              <div className="collection" key={collection.id}>
                <div className="collection-head">
                  <Icon.Folder size={14} />
                  <span className="collection-name" title={collection.name}>
                    {collection.name}
                  </span>
                  <span className="count">{collection.requests.length}</span>
                  <button
                    className="icon-btn subtle"
                    title="Delete collection"
                    onClick={() => onDeleteCollection(collection)}
                  >
                    <Icon.Trash size={13} />
                  </button>
                </div>

                {collection.requests.length === 0 && (
                  <div className="collection-empty">No requests in this collection</div>
                )}

                {collection.requests.map((saved) => (
                  <div className="saved-item" key={saved.id}>
                    <button className="saved-load" onClick={() => onLoadSaved(saved)} title={saved.name}>
                      <span className="method-tag small">
                        {saved.request.method || 'GET'}
                      </span>
                      <span className="saved-name">{saved.name}</span>
                    </button>
                    <button
                      className="icon-btn subtle"
                      title="Delete saved request"
                      onClick={() => onDeleteSaved(collection.id, saved)}
                    >
                      <Icon.Close size={12} />
                    </button>
                  </div>
                ))}
              </div>
            ))}
          </>
        )}
      </div>

      <div className="sidebar-vars">
        <button className="vars-toggle" onClick={() => setShowVars((value) => !value)}>
          <Icon.Code size={14} />
          <span>Variables</span>
          {varCount > 0 && <span className="count">{varCount}</span>}
          <Icon.Chevron size={14} className={`chevron${showVars ? ' open' : ''}`} />
        </button>
        {showVars && (
          <div className="vars-body">
            <p className="vars-hint">
              One <code>key=value</code> per line. Use <code>{'{{key}}'}</code> in any field.
            </p>
            <textarea
              className="vars-input"
              value={variablesText}
              spellCheck={false}
              placeholder={'baseUrl=https://api.example.com\ntoken=abc123'}
              onChange={(event) => onVarsChange(event.target.value)}
            />
          </div>
        )}
      </div>
    </aside>
  );
}
