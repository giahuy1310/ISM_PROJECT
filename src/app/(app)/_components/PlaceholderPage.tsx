'use client';

import { motion } from 'framer-motion';
import { bouncy, cardContainerVariants, cardPopVariants, useMotionPreference } from './motion-presets';

export function PlaceholderPage({
  title,
  subtitle,
  icon,
}: {
  title: string;
  subtitle: string;
  icon: string;
}) {
  const { reducedMotion } = useMotionPreference();

  return (
    <section className="space-y-6">
      <motion.div
        className="bg-surface-container-lowest rounded-xl p-8 shadow-[inset_0_0_0_1px_rgba(196,198,204,0.15)]"
        initial={{ opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={bouncy}
      >
        <motion.span
          className="material-symbols-outlined text-5xl text-on-primary-fixed inline-block"
          animate={reducedMotion ? undefined : { y: [0, -8, 0] }}
          transition={{ repeat: Infinity, duration: 1.6 }}
        >
          {icon}
        </motion.span>
        <h1 className="mt-4 text-3xl font-headline font-black text-on-primary-fixed">{title}</h1>
        <p className="mt-2 text-sm text-on-surface-variant">{subtitle}</p>
      </motion.div>

      <motion.div
        className="grid grid-cols-1 md:grid-cols-3 gap-4"
        variants={cardContainerVariants}
        initial="hidden"
        animate="show"
      >
        {['KPI snapshot', 'Trend chart', 'Actions queue'].map((label) => (
          <motion.div
            key={label}
            variants={cardPopVariants}
            whileHover={reducedMotion ? undefined : { y: -4, scale: 1.02 }}
            whileTap={reducedMotion ? undefined : { scale: 0.97 }}
            className="bg-surface-container-lowest rounded-lg p-5 shadow-[inset_0_0_0_1px_rgba(196,198,204,0.15)]"
          >
            <div className="text-xs uppercase tracking-wider text-on-surface-variant font-semibold mb-3">{label}</div>
            <div className="h-3 rounded bg-surface-container-high animate-shimmer mb-2" />
            <div className="h-3 rounded bg-surface-container-high animate-shimmer w-4/5 mb-2" />
            <div className="h-3 rounded bg-surface-container-high animate-shimmer w-3/5" />
          </motion.div>
        ))}
      </motion.div>
    </section>
  );
}
