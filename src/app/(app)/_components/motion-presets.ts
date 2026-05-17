'use client';

import { useReducedMotion, type Variants } from 'framer-motion';

type Spring = {
  type: 'spring';
  stiffness: number;
  damping: number;
};

export const bouncy: Spring = {
  type: 'spring',
  stiffness: 420,
  damping: 22,
};

export const snappy: Spring = {
  type: 'spring',
  stiffness: 320,
  damping: 30,
};

export const cardContainerVariants: Variants = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.05,
    },
  },
};

export const cardPopVariants: Variants = {
  hidden: { opacity: 0, y: 20, scale: 0.96 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: bouncy,
  },
};

export function useMotionPreference() {
  const reducedMotion = useReducedMotion();
  return {
    reducedMotion,
    hoverScale: reducedMotion ? 1 : 1.02,
    tapScale: reducedMotion ? 1 : 0.95,
    pageTransition: reducedMotion ? { duration: 0.1 } : snappy,
  };
}
