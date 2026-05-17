'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { bouncy, useMotionPreference } from '../_components/motion-presets';
import { AddOrderView } from './_components/AddOrderView';
import { SqlQueryView } from './_components/SqlQueryView';

type Mode = 'add' | 'sql';

const MODES: { id: Mode; label: string; icon: string; description: string }[] = [
  {
    id: 'add',
    label: 'Add Order',
    icon: 'add_circle',
    description: 'Enter a new order manually or upload an Excel file',
  },
  {
    id: 'sql',
    label: 'SQL Insert',
    icon: 'database',
    description: 'Write a raw INSERT statement directly',
  },
];

export default function OrdersPage() {
  const [mode, setMode] = useState<Mode>('add');
  const { reducedMotion } = useMotionPreference();
  const active = MODES.find((m) => m.id === mode)!;

  return (
    <section className="space-y-6 max-w-4xl">
      {/* Header */}
      <motion.div
        className="bg-surface-container-lowest rounded-xl p-8 shadow-[inset_0_0_0_1px_rgba(196,198,204,0.15)]"
        initial={{ opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={bouncy}
      >
        <AnimatePresence mode="wait">
          <motion.span
            key={active.icon}
            className="material-symbols-outlined text-4xl text-on-primary-fixed inline-block"
            initial={{ opacity: 0, scale: 0.7, rotate: -12 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            exit={{ opacity: 0, scale: 0.7, rotate: 12 }}
            transition={reducedMotion ? { duration: 0.1 } : bouncy}
          >
            {active.icon}
          </motion.span>
        </AnimatePresence>

        <div className="mt-3 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-headline font-black text-on-primary-fixed">
              Orders
            </h1>
            <AnimatePresence mode="wait">
              <motion.p
                key={mode}
                className="mt-1 text-sm text-on-surface-variant"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={reducedMotion ? { duration: 0.1 } : { duration: 0.2 }}
              >
                {active.description}
              </motion.p>
            </AnimatePresence>
          </div>

          {/* Mode switcher — segmented control */}
          <div className="inline-flex items-center gap-1 bg-surface-container-high rounded-xl p-1 shadow-[inset_0_0_0_1px_rgba(196,198,204,0.2)]">
            {MODES.map((m) => {
              const isActive = mode === m.id;
              return (
                <motion.button
                  key={m.id}
                  type="button"
                  onClick={() => setMode(m.id)}
                  whileTap={reducedMotion ? undefined : { scale: 0.95 }}
                  className="relative inline-flex items-center gap-2 rounded-lg px-4 h-9 text-sm font-body font-semibold transition-colors"
                  aria-pressed={isActive}
                >
                  {isActive && (
                    <motion.span
                      layoutId="modePill"
                      className="absolute inset-0 rounded-lg bg-surface-container-lowest shadow-sm"
                      transition={reducedMotion ? { duration: 0.1 } : bouncy}
                    />
                  )}
                  <span
                    className={`material-symbols-outlined text-base relative z-10 transition-colors ${
                      isActive ? 'text-primary' : 'text-on-surface-variant'
                    }`}
                    style={isActive ? { fontVariationSettings: "'FILL' 1" } : undefined}
                  >
                    {m.icon}
                  </span>
                  <span
                    className={`relative z-10 transition-colors ${
                      isActive ? 'text-on-surface' : 'text-on-surface-variant'
                    }`}
                  >
                    {m.label}
                  </span>
                </motion.button>
              );
            })}
          </div>
        </div>
      </motion.div>

      {/* Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={mode}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={reducedMotion ? { duration: 0.1 } : { ...bouncy, stiffness: 300 }}
        >
          {mode === 'add' ? <AddOrderView /> : <SqlQueryView />}
        </motion.div>
      </AnimatePresence>
    </section>
  );
}
