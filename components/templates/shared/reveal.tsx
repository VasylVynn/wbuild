"use client";

import { motion, type UseInViewOptions } from "framer-motion";
import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";

/*
 * Progressive-enhancement gate for scroll-reveal animations (H5).
 *
 * framer-motion serializes the `initial` hidden state as an inline
 * `opacity:0` style into the SSR HTML, so without JS (SEO bots, slow
 * devices, no-JS clients) revealed sections stay invisible forever.
 *
 * The gate flips that around: SSR and the first client render output plain,
 * fully visible markup. After hydration, only elements still BELOW the fold
 * arm the real framer reveal; elements already on screen stay visible (no
 * hide-then-animate flash). Reduced-motion users never arm at all.
 */
export function useRevealGate<T extends HTMLElement>(): [RefObject<T | null>, boolean] {
  const ref = useRef<T>(null);
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }
    const rect = el.getBoundingClientRect();
    const inView = rect.top < window.innerHeight && rect.bottom > 0;
    if (!inView) setArmed(true);
  }, []);
  return [ref, armed];
}

/**
 * Generic gated fade+lift reveal — the shared replacement for inline
 * `motion.div initial={{opacity:0,y}} whileInView=…` wrappers in template
 * sections. Defaults mirror the studio template's typical values.
 */
export function Reveal({
  children,
  className,
  y = 16,
  delay = 0,
  duration = 0.6,
  margin,
}: {
  children: ReactNode;
  className?: string;
  y?: number;
  delay?: number;
  duration?: number;
  /** framer viewport margin, e.g. "-60px" */
  margin?: UseInViewOptions["margin"];
}) {
  const [ref, armed] = useRevealGate<HTMLDivElement>();
  if (!armed) {
    return (
      <div ref={ref} className={className}>
        {children}
      </div>
    );
  }
  return (
    <motion.div
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, ...(margin ? { margin } : {}) }}
      transition={{ duration, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
