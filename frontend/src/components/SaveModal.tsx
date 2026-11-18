import { useState } from 'react';
import type { Collection } from '../types';
import * as Icon from './Icons';

interface Props {
  collections: Collection[];
  defaultName: string;
  onClose: () => void;
  onSubmit: (target: {
    collectionId?: string;
    newCollection?: string;
    name: string;
  }) => Promise<void>;
}

export default function SaveModal({ collections, defaultName, onClose, onSubmit }: Props) {
  const [name, setName] = useState(defaultName);
  const [collectionId, setCollectionId] = useState(collections[0]?.id ?? 'new');
  const [newCollection, setNewCollection] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (busy) return;
    if (!name.trim()) {
      setError('Give this request a name.');
      return;
    }
    if (collectionId === 'new' && !newCollection.trim()) {
      setError('Enter a name for the new collection.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onSubmit({
        collectionId: collectionId === 'new' ? undefined : collectionId,
        newCollection: collectionId === 'new' ? newCollection.trim() : undefined,
        name: name.trim(),
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the request.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-overlay" onMouseDown={onClose}>
      <div
        className="modal"
        onMouseDown={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          if (event.key === 'Escape') onClose();
          if (event.key === 'Enter') submit();
        }}
      >
        <div className="modal-head">
          <h2>Save request</h2>
          <button className="icon-btn" onClick={onClose} title="Close">
            <Icon.Close size={16} />
          </button>
        </div>

        <label className="field">
          <span>Request name</span>
          <input
            autoFocus
            value={name}
            placeholder="Get users"
            onChange={(event) => setName(event.target.value)}
          />
        </label>

        <label className="field">
          <span>Collection</span>
          <select value={collectionId} onChange={(event) => setCollectionId(event.target.value)}>
            {collections.map((collection) => (
              <option key={collection.id} value={collection.id}>
                {collection.name}
              </option>
            ))}
            <option value="new">+ New collection</option>
          </select>
        </label>

        {collectionId === 'new' && (
          <label className="field">
            <span>New collection name</span>
            <input
              value={newCollection}
              placeholder="My API"
              onChange={(event) => setNewCollection(event.target.value)}
            />
          </label>
        )}

        {error && <div className="modal-error">{error}</div>}

        <div className="modal-actions">
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={submit} disabled={busy}>
            {busy ? 'Saving…' : 'Save request'}
          </button>
        </div>
      </div>
    </div>
  );
}
