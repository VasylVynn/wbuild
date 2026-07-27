"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Smooths bursty SSE text into a steady character flow: while `active`, the
 * returned string trails `target` and catches up a few characters per frame —
 * the reveal rate scales with the backlog, so a burst of chunks types faster
 * instead of falling behind. When `active` is false (historical bubbles, the
 * canonical final replace) — or the user prefers reduced motion — it mirrors
 * `target` directly.
 */
// Advance by GRAPHEME clusters, never raw UTF-16 units — slicing mid-surrogate
// (emoji, flags, ZWJ sequences) would flash broken replacement characters.
const seg =
  typeof Intl !== "undefined" && "Segmenter" in Intl
    ? new Intl.Segmenter("uk", { granularity: "grapheme" })
    : null;

/** Fallback clusterer for engines without Intl.Segmenter: UTF-16 length of the
 * first cluster of `text`. Keeps surrogate pairs, combining marks, variation
 * selectors, skin tones, ZWJ chains and flag (regional-indicator) pairs whole. */
function nextClusterLength(text: string): number {
  const first = text.codePointAt(0);
  if (first === undefined) return 0;
  let i = first > 0xffff ? 2 : 1;
  const isRI = (c: number) => c >= 0x1f1e6 && c <= 0x1f1ff;
  if (isRI(first)) {
    const second = text.codePointAt(i);
    if (second !== undefined && isRI(second)) i += 2;
    return i;
  }
  for (;;) {
    const c = text.codePointAt(i);
    if (c === undefined) break;
    const isJoiner =
      c === 0x200d || // ZWJ
      (c >= 0x0300 && c <= 0x036f) || // combining diacritics
      (c >= 0xfe00 && c <= 0xfe0f) || // variation selectors
      (c >= 0x1f3fb && c <= 0x1f3ff); // skin tones
    if (!isJoiner) break;
    i += c > 0xffff ? 2 : 1;
    if (c === 0x200d) {
      const joined = text.codePointAt(i);
      if (joined !== undefined) i += joined > 0xffff ? 2 : 1;
    }
  }
  return i;
}

/** Length (in UTF-16 units) of the first `count` graphemes of `text`. */
function graphemeAdvance(text: string, count: number): number {
  let units = 0;
  if (seg) {
    let taken = 0;
    for (const s of seg.segment(text)) {
      if (taken >= count) break;
      units += s.segment.length;
      taken++;
    }
    return units;
  }
  for (let taken = 0; taken < count; taken++) {
    const len = nextClusterLength(text.slice(units));
    if (len === 0) break;
    units += len;
  }
  return units;
}

export function useSmoothText(target: string, active: boolean): string {
  const [shown, setShown] = useState(active ? "" : target);
  const ref = useRef({ shown: active ? "" : target, target, carry: 0, wasActive: active });
  ref.current.target = target;
  if (active) ref.current.wasActive = true;

  useEffect(() => {
    const st = ref.current;

    // Bubble that never streamed (history render): mirror the target, no animation.
    if (!active && !st.wasActive) {
      if (st.shown !== target) {
        st.shown = target;
        st.carry = 0;
        setShown(target);
      }
      return;
    }

    // Post-stream canonical replace that does NOT continue the streamed text —
    // snap rather than retyping the whole bubble.
    if (!active && !target.startsWith(st.shown)) {
      st.shown = target;
      st.carry = 0;
      setShown(target);
      return;
    }

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      // No typing animation — just keep the bubble in sync.
      if (st.shown !== target) {
        st.shown = target;
        setShown(target);
      }
      return;
    }

    if (!active && st.shown === target) return; // caught up — nothing to animate

    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const st2 = ref.current;
      // Slot reuse (retry, next turn painting over): target no longer extends
      // what's shown — restart the reveal from scratch.
      if (!st2.target.startsWith(st2.shown)) {
        st2.shown = "";
        st2.carry = 0;
      }
      const backlog = st2.target.length - st2.shown.length;
      if (backlog > 0) {
        // Readable pace with a hard ceiling while the stream runs — uncapped
        // catch-up reads as an unreadable flicker. Once the stream ended,
        // finish the tail faster but still visibly (never an instant snap).
        const cps = active
          ? Math.min(140, Math.max(35, backlog * 3))
          : Math.max(220, backlog * 8);
        st2.carry += ((now - last) / 1000) * cps;
        const step = Math.floor(st2.carry);
        if (step > 0) {
          const units = graphemeAdvance(st2.target.slice(st2.shown.length), step);
          st2.carry -= step;
          st2.shown = st2.target.slice(0, st2.shown.length + units);
          setShown(st2.shown);
        }
      } else {
        st2.carry = 0;
        if (!active) return; // tail finished after stream end — stop the loop
      }
      last = now;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, target]);

  return shown;
}
