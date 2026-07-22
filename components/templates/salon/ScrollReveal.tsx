"use client";

import { motion, type Variants } from "framer-motion";
import { useEffect, useState, type ReactNode } from "react";
import { useRevealGate } from "../shared/reveal";

/*
 * ScrollReveal — salon's fade + directional slide + blur-in (once). Motion
 * values are the verbatim salon port; the reveal is gated behind useRevealGate
 * (H5): SSR markup is fully visible, only below-the-fold elements arm the
 * animation after hydration.
 */
export function ScrollReveal({
  children,
  delay = 0,
  direction = "up",
  duration = 0.8,
  className = "",
}: {
  children: ReactNode;
  delay?: number;
  direction?: "up" | "down" | "left" | "right";
  duration?: number;
  className?: string;
}) {
  const [ref, armed] = useRevealGate<HTMLDivElement>();
  // NOT framer's useInView: its observer binds once to the pre-arm plain div,
  // which the armed render replaces — it would watch a detached node and never
  // fire. This effect re-binds on `armed`, so it observes the LIVE node.
  const [inView, setInView] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          obs.disconnect();
        }
      },
      { rootMargin: "-50px" },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [armed, ref]);

  const variants: Variants = {
    hidden: {
      opacity: 0,
      x: direction === "left" ? -40 : direction === "right" ? 40 : 0,
      y: direction === "up" ? 40 : direction === "down" ? -40 : 0,
      filter: "blur(4px)",
    },
    visible: {
      opacity: 1,
      x: 0,
      y: 0,
      filter: "blur(0px)",
      transition: { duration, delay, ease: [0.22, 1, 0.36, 1] },
    },
  };

  if (!armed) {
    return (
      <div ref={ref} className={className}>
        {children}
      </div>
    );
  }
  return (
    <motion.div
      ref={ref}
      initial="hidden"
      animate={inView ? "visible" : "hidden"}
      variants={variants}
      className={className}
    >
      {children}
    </motion.div>
  );
}
