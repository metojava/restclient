import type { KeyValueRow } from '../types';
import { emptyRow } from '../utils';
import * as Icon from './Icons';

interface Props {
  rows: KeyValueRow[];
  onChange: (rows: KeyValueRow[]) => void;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
}

export default function KeyValueEditor({
  rows,
  onChange,
  keyPlaceholder = 'Key',
  valuePlaceholder = 'Value',
}: Props) {
  const update = (index: number, patch: Partial<KeyValueRow>) => {
    const next = rows.map((row, i) => (i === index ? { ...row, ...patch } : row));
    if (index === rows.length - 1 && (patch.key || patch.value)) {
      next.push(emptyRow());
    }
    onChange(next);
  };

  const remove = (index: number) => {
    const next = rows.filter((_, i) => i !== index);
    onChange(next.length ? next : [emptyRow()]);
  };

  return (
    <div className="kv-editor">
      <div className="kv-head">
        <span />
        <span>{keyPlaceholder}</span>
        <span>{valuePlaceholder}</span>
        <span />
      </div>
      {rows.map((row, index) => (
        <div className={`kv-row${row.enabled ? '' : ' disabled'}`} key={row.id}>
          <input
            type="checkbox"
            className="row-check"
            checked={row.enabled}
            onChange={(event) => update(index, { enabled: event.target.checked })}
            title="Include this row"
          />
          <input
            className="kv-input"
            value={row.key}
            placeholder={keyPlaceholder}
            spellCheck={false}
            onChange={(event) => update(index, { key: event.target.value })}
          />
          <input
            className="kv-input"
            value={row.value}
            placeholder={valuePlaceholder}
            spellCheck={false}
            onChange={(event) => update(index, { value: event.target.value })}
          />
          <button className="icon-btn subtle" title="Remove row" onClick={() => remove(index)}>
            <Icon.Close size={14} />
          </button>
        </div>
      ))}
      <button
        className="add-row"
        onClick={() => onChange([...rows, emptyRow()])}
      >
        <Icon.Plus size={14} /> Add row
      </button>
    </div>
  );
}
