"use client";

import { useEffect } from "react";
import type { MotionId } from "@/lib/theme/dna";

/**
 * Scroll-reveal driver (wave DNA-1, motionId from the design DNA). H5 rules
 * hold: sections are FULLY visible without JS — this arms below-the-fold
 * sections only after hydration, then a CSS transition reveals them on
 * intersection. `prefers-reduced-motion` disables everything. CSS lives in
 * globals.css (`.mo-armed`, `[data-motion="stagger"]` delays) — zero JS
 * animation libraries on the lead-funnel page.
 */
export function MotionDriver({ motionId }: { motionId: MotionId }) {
  useEffect(() => {
    if (motionId === "none") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const sections = Array.from(document.querySelectorAll<HTMLElement>("main section"));
    if (sections.length === 0) return;

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            (e.target as HTMLElement).classList.remove("mo-armed");
            io.unobserve(e.target);
          }
        }
      },
      { rootMargin: "0px 0px -8% 0px" },
    );

    for (const s of sections) {
      // Only sections still below the viewport get hidden — anything already
      // on screen (or above) stays put, so hydration never blanks content.
      if (s.getBoundingClientRect().top > window.innerHeight) {
        s.classList.add("mo-armed");
        io.observe(s);
      }
    }
    return () => io.disconnect();
  }, [motionId]);

  return null;
}
