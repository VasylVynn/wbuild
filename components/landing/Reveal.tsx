"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Scroll-reveal wrapper for the marketing landing: the subtree fades up once,
 * the first time it crosses into the viewport, then the observer detaches.
 * SSR (and any client where the effect never runs — no JS, hydration failure)
 * renders VISIBLE; the hidden state is only applied after mount, and only to
 * elements still below the fold, so content is never gated behind JS.
 */
export function Reveal({
  children,
  className = "",
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // Already in the first viewport → keep it visible, no animation to run.
    if (node.getBoundingClientRect().top < window.innerHeight) return;

    setHidden(true);
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          setHidden(false);
          observer.unobserve(entry.target);
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -40px 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    // Named transition properties (never `all`), and will-change only while
    // the reveal is actually pending — a permanent hint on every section
    // wrapper holds compositor layers for nothing (design review 2026-08-10).
    <div
      ref={ref}
      style={{ transitionDelay: `${delay}ms` }}
      className={`transition-[transform,opacity] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] ${
        hidden ? "translate-y-6 opacity-0 will-change-transform" : "translate-y-0 opacity-100"
      } ${className}`}
    >
      {children}
    </div>
  );
}
