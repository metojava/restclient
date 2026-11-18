import type { ChangeEvent } from 'react';
import type { FormRow } from '../types';
import { emptyFormRow } from '../utils';
import * as Icon from './Icons';

interface Props {
  rows: FormRow[];
  onChange: (rows: FormRow[]) => void;
}

export default function FormDataEditor({ rows, onChange }: Props) {
  const update = (index: number, patch: Partial<FormRow>) => {
    const next = rows.map((row, i) => (i === index ? { ...row, ...patch } : row));
    if (index === rows.length - 1 && (patch.key || patch.value)) {
      next.push(emptyFormRow());
    }
    onChange(next);
  };

  const remove = (index: number) => {
    const next = rows.filter((_, i) => i !== index);
    onChange(next.length ? next : [emptyFormRow()]);
  };

  const pickFile = (index: number, event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      update(index, {
        fileName: file.name,
        contentType: file.type || 'application/octet-stream',
        fileBase64: typeof reader.result === 'string' ? reader.result : '',
        value: '',
      });
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="kv-editor">
      <div className="kv-head form-head">
        <span />
        <span>Key</span>
        <span>Type</span>
        <span>Value</span>
        <span />
      </div>
      {rows.map((row, index) => (
        <div className={`kv-row form-row${row.enabled ? '' : ' disabled'}`} key={row.id}>
          <input
            type="checkbox"
            className="row-check"
            checked={row.enabled}
            onChange={(event) => update(index, { enabled: event.target.checked })}
            title="Include this field"
          />
          <input
            className="kv-input"
            value={row.key}
            placeholder="Field name"
            spellCheck={false}
            onChange={(event) => update(index, { key: event.target.value })}
          />
          <select
            className="mini-select"
            value={row.fieldType}
            onChange={(event) =>
              update(index, { fieldType: event.target.value === 'file' ? 'file' : 'text' })
            }
          >
            <option value="text">Text</option>
            <option value="file">File</option>
          </select>
          {row.fieldType === 'file' ? (
            <label className="file-pick">
              <input type="file" onChange={(event) => pickFile(index, event)} />
              <span className="file-label">
                <Icon.Folder size={14} />
                {row.fileName || 'Choose file'}
              </span>
            </label>
          ) : (
            <input
              className="kv-input"
              value={row.value}
              placeholder="Value"
              spellCheck={false}
              onChange={(event) => update(index, { value: event.target.value })}
            />
          )}
          <button className="icon-btn subtle" title="Remove field" onClick={() => remove(index)}>
            <Icon.Close size={14} />
          </button>
        </div>
      ))}
      <button className="add-row" onClick={() => onChange([...rows, emptyFormRow()])}>
        <Icon.Plus size={14} /> Add field
      </button>
    </div>
  );
}
