"use client";

import type { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";

type LandingRevealProps = {
  children: ReactNode;
  className?: string;
  delay?: number;
  onLoad?: boolean;
};

export function LandingReveal({ children, className, delay = 0, onLoad = false }: LandingRevealProps) {
  const reducedMotion = useReducedMotion();
  const visible = { opacity: 1, y: 0 };

  return (
    <motion.div
      className={className}
      initial={reducedMotion ? false : { opacity: 0, y: 20 }}
      animate={onLoad ? visible : undefined}
      whileInView={onLoad ? undefined : visible}
      viewport={onLoad ? undefined : { once: true, amount: 0.15, margin: "0px 0px -32px 0px" }}
      transition={{ duration: reducedMotion ? 0 : 0.58, delay: reducedMotion ? 0 : delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
