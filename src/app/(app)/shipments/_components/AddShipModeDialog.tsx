'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { bouncy, useMotionPreference } from '../../_components/motion-presets';

const FIELD_CLASS =
  'w-full bg-surface-container-low border border-[rgba(196,198,204,0.2)] rounded-lg px-3 py-2 text-sm text-on-surface outline-none focus:border-primary transition-colors';

export function AddShipModeDialog({
  open,
  onClose,
  onAdded,
}: {
  open: boolean;
  onClose: () => void;
  onAdded: () => void;
}) {
  const { reducedMotion } = useMotionPreference();
  const [name, setName] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  function reset() {
    setName('');
    setStatus('idle');
    setErrorMsg('');
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (status === 'loading') return;
    setStatus('loading');
    setErrorMsg('');
    try {
      const res = await fetch('/api/shipmodes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ShipMode: name.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        reset();
        onAdded();
        return;
      }
      setStatus('error');
      setErrorMsg(typeof data.error === 'string' ? data.error : 'Request failed');
    } catch {
      setStatus('error');
      setErrorMsg('Network error');
    }
  }

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={reducedMotion ? { duration: 0.1 } : { duration: 0.2 }}
          role="presentation"
          onClick={handleClose}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-ship-mode-title"
            className="w-full max-w-md rounded-xl bg-surface-container-lowest p-6 shadow-[inset_0_0_0_1px_rgba(196,198,204,0.15)]"
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={reducedMotion ? { duration: 0.1 } : bouncy}
            onClick={(ev) => ev.stopPropagation()}
          >
            <h2 id="add-ship-mode-title" className="text-lg font-headline font-bold text-on-surface mb-1">
              Add ship mode
            </h2>
            <p className="text-xs text-on-surface-variant mb-4">Enter a name. A new ID will be assigned automatically.</p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="ship-mode-name" className="block text-xs font-label font-semibold text-on-surface-variant mb-1">
                  Ship mode name
                </label>
                <input
                  id="ship-mode-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={FIELD_CLASS}
                  placeholder="e.g. Express Overnight"
                  maxLength={50}
                  autoComplete="off"
                  disabled={status === 'loading'}
                />
              </div>
              {errorMsg ? <p className="text-xs text-red-500">{errorMsg}</p> : null}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleClose}
                  className="rounded-full px-4 h-9 text-sm text-on-surface-variant hover:bg-surface-container-high transition-colors"
                  disabled={status === 'loading'}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={status === 'loading' || !name.trim()}
                  className="inline-flex items-center gap-2 rounded-full px-5 h-9 text-sm font-semibold bg-primary text-on-primary hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {status === 'loading' ? (
                    <>
                      <span className="material-symbols-outlined text-base animate-spin">progress_activity</span>
                      Saving…
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-base">add_circle</span>
                      Save
                    </>
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
