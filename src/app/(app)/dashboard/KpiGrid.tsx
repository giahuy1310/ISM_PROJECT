'use client';

import { motion } from 'framer-motion';
import { bouncy, cardContainerVariants, cardPopVariants } from '../_components/motion-presets';

type KpiItem = {
  id: string;
  label: string;
  value: string;
};

export function KpiGrid({ items }: { items: KpiItem[] }) {
  return (
    <motion.div
      className="grid grid-cols-2 md:grid-cols-5 gap-4"
      variants={cardContainerVariants}
      initial="hidden"
      animate="show"
    >
      {items.map((kpi) => (
        <motion.div
          key={kpi.id}
          variants={cardPopVariants}
          whileHover={{ y: -4, scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          transition={bouncy}
          className="bg-surface-container-lowest rounded-lg p-5 flex flex-col justify-between shadow-[inset_0_0_0_1px_rgba(196,198,204,0.15)]"
        >
          <h3 className="text-xs font-body font-semibold text-on-surface-variant uppercase tracking-wider mb-2">{kpi.label}</h3>
          <div className="text-3xl font-headline font-extrabold text-on-primary-fixed">{kpi.value}</div>
        </motion.div>
      ))}
    </motion.div>
  );
}
