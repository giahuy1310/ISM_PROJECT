'use client';

import { type SyntheticEvent, useMemo, useState } from 'react';

type Status = 'idle' | 'loading' | 'success' | 'error';

type QuerySuccess = {
  success: true;
  rowCount: number;
  affectedRows?: number;
  insertId?: number;
  rows?: unknown[];
  fields?: string[];
};

type QueryError = {
  error: string;
  code?: string;
};

const PLACEHOLDER = `SELECT OrderID, Sales, Profit
FROM fact_retailorder
ORDER BY OrderDate DESC
LIMIT 25;`;

function prettyJson(value: unknown) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return '[unserializable-result]';
  }
}

export function DevSqlWorkspace() {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [result, setResult] = useState<QuerySuccess | QueryError | null>(null);

  const lines = useMemo(() => {
    const trimmed = query.trim();
    if (!trimmed) return 'No query written';
    const count = trimmed.split('\n').length;
    return `${count} line${count === 1 ? '' : 's'}`;
  }, [query]);

  async function runQuery(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!query.trim() || status === 'loading') return;

    setStatus('loading');
    setResult(null);

    try {
      const res = await fetch('/api/dev/sql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });

      const data = (await res.json()) as QuerySuccess | QueryError;

      if (res.ok) {
        setStatus('success');
        setResult(data);
        return;
      }

      setStatus('error');
      setResult(data);
    } catch (error) {
      setStatus('error');
      setResult({ error: error instanceof Error ? error.message : 'Network error' });
    }
  }

  return (
    <div className="space-y-6">
      <div className="bg-surface-container-lowest rounded-xl shadow-[inset_0_0_0_1px_rgba(196,198,204,0.15)] overflow-hidden">
        <form onSubmit={runQuery}>
          <div className="p-4 border-b border-[rgba(196,198,204,0.12)] flex items-center gap-2">
            <span className="material-symbols-outlined text-base text-on-surface-variant">code</span>
            <span className="text-xs font-label font-semibold text-on-surface-variant uppercase tracking-wider">
              SQL Editor
            </span>
          </div>

          <textarea
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={PLACEHOLDER}
            rows={14}
            spellCheck={false}
            className="w-full bg-surface-container-low font-mono text-sm text-on-surface placeholder:text-on-surface-variant/40 p-5 outline-none resize-none leading-relaxed"
          />

          <div className="p-4 border-t border-[rgba(196,198,204,0.12)] flex items-center justify-between gap-4">
            <span className="text-xs text-on-surface-variant font-label">{lines}</span>
            <button
              type="submit"
              disabled={!query.trim() || status === 'loading'}
              className="inline-flex items-center gap-2 rounded-full px-5 h-9 text-sm font-body font-semibold bg-primary text-on-primary hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {status === 'loading' ? 'Running...' : 'Run Query'}
            </button>
          </div>
        </form>
      </div>

      {result !== null && (
        <div
          className={`rounded-xl p-5 shadow-[inset_0_0_0_1px_rgba(196,198,204,0.15)] ${
            status === 'success' ? 'bg-[rgba(0,128,64,0.08)]' : 'bg-[rgba(180,0,0,0.07)]'
          }`}
        >
          {'success' in result ? (
            <div className="space-y-3">
              <p className="text-sm font-semibold text-on-surface">Query completed</p>
              <p className="text-xs text-on-surface-variant font-mono">
                rowCount: {result.rowCount}
                {typeof result.affectedRows === 'number' ? ` · affectedRows: ${result.affectedRows}` : ''}
                {typeof result.insertId === 'number' ? ` · insertId: ${result.insertId}` : ''}
              </p>
              {Array.isArray(result.rows) && result.rows.length > 0 ? (
                <pre className="text-xs font-mono text-on-surface bg-surface-container-low rounded-lg p-3 overflow-x-auto max-h-80">
                  {prettyJson(result.rows)}
                </pre>
              ) : null}
            </div>
          ) : (
            <div className="space-y-1">
              <p className="text-sm font-semibold text-on-surface">{result.code ?? 'Error'}</p>
              <p className="text-xs text-on-surface-variant font-mono break-all">{result.error}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
