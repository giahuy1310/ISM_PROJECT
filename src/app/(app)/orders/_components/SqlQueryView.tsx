'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { bouncy, cardPopVariants, useMotionPreference } from '../../_components/motion-presets';

const PLACEHOLDER = `INSERT INTO fact_retailorder
  (OrderID, OrderDate, ShipDate, ShipModeID, CustomerID,
   PostalCode, RetailSalesPeopleID, ProductID,
   Returned, ShipStatus, Sales, Quantity, Profit, Cost, Days)
VALUES
  ('CA-2026-999', '2026-05-01', NULL, 1, 'CG-12520',
   10024, 1, 'FUR-BO-10001798',
   'No', 'On-Time', 250.00, 2, 80.00, 170.00, 3);`;

type Status = 'idle' | 'loading' | 'success' | 'error';

interface ApiSuccess {
  success: true;
  insertId: number;
  affectedRows: number;
}

interface ApiError {
  error: string;
  code?: string;
}

export function SqlQueryView() {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [result, setResult] = useState<ApiSuccess | ApiError | null>(null);
  const { reducedMotion } = useMotionPreference();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim() || status === 'loading') return;

    setStatus('loading');
    setResult(null);

    try {
      const res = await fetch('/api/orders/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });

      const data = await res.json();

      if (res.ok) {
        setStatus('success');
        setResult(data as ApiSuccess);
      } else {
        setStatus('error');
        setResult(data as ApiError);
      }
    } catch (err) {
      setStatus('error');
      setResult({ error: err instanceof Error ? err.message : 'Network error' });
    }
  }

  return (
    <div className="space-y-6">
      <motion.div
        variants={cardPopVariants}
        initial="hidden"
        animate="show"
        className="bg-surface-container-lowest rounded-xl shadow-[inset_0_0_0_1px_rgba(196,198,204,0.15)] overflow-hidden"
      >
        <form onSubmit={handleSubmit}>
          <div className="p-4 border-b border-[rgba(196,198,204,0.12)] flex items-center gap-2">
            <span className="material-symbols-outlined text-base text-on-surface-variant">code</span>
            <span className="text-xs font-label font-semibold text-on-surface-variant uppercase tracking-wider">
              SQL Editor
            </span>
          </div>

          <div className="relative">
            <textarea
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={PLACEHOLDER}
              rows={14}
              spellCheck={false}
              className="w-full bg-surface-container-low font-mono text-sm text-on-surface placeholder:text-on-surface-variant/40 p-5 outline-none resize-none leading-relaxed"
            />
          </div>

          <div className="p-4 border-t border-[rgba(196,198,204,0.12)] flex items-center justify-between gap-4">
            <span className="text-xs text-on-surface-variant font-label">
              {query.trim().length > 0
                ? `${query.trim().split('\n').length} line${query.trim().split('\n').length !== 1 ? 's' : ''}`
                : 'No query written'}
            </span>
            <button
              type="submit"
              disabled={status === 'loading' || !query.trim()}
              className="inline-flex items-center gap-2 rounded-full px-5 h-9 text-sm font-body font-semibold bg-primary text-on-primary hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {status === 'loading' ? (
                <>
                  <span className="material-symbols-outlined text-base animate-spin">progress_activity</span>
                  Running…
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-base">play_arrow</span>
                  Run Query
                </>
              )}
            </button>
          </div>
        </form>
      </motion.div>

      <AnimatePresence>
        {result !== null && (
          <motion.div
            key={status}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={reducedMotion ? { duration: 0.15 } : bouncy}
            className={`rounded-xl p-5 shadow-[inset_0_0_0_1px_rgba(196,198,204,0.15)] flex gap-3 ${
              status === 'success'
                ? 'bg-[rgba(0,128,64,0.08)]'
                : 'bg-[rgba(180,0,0,0.07)]'
            }`}
          >
            <span
              className={`material-symbols-outlined text-xl mt-0.5 shrink-0 ${
                status === 'success' ? 'text-green-500' : 'text-red-500'
              }`}
            >
              {status === 'success' ? 'check_circle' : 'error'}
            </span>
            <div className="space-y-1 min-w-0">
              {status === 'success' ? (
                <>
                  <p className="text-sm font-semibold text-on-surface">
                    Inserted successfully
                  </p>
                  <p className="text-xs text-on-surface-variant font-mono">
                    RetailOrderID: {(result as ApiSuccess).insertId}
                    {' · '}
                    affectedRows: {(result as ApiSuccess).affectedRows}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm font-semibold text-on-surface">
                    {(result as ApiError).code ?? 'Error'}
                  </p>
                  <p className="text-xs text-on-surface-variant font-mono break-all">
                    {(result as ApiError).error}
                  </p>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
