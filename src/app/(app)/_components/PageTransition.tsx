'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { usePathname } from 'next/navigation';
import { useMotionPreference } from './motion-presets';

export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { pageTransition } = useMotionPreference();

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={pathname}
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -8, scale: 0.98 }}
        transition={pageTransition}
        className="flex-1"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
