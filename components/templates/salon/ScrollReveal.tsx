"use client";

import { motion, useInView, type Variants } from "framer-motion";
import { useRef, type ReactNode } from "react";

/*
 * ScrollReveal — verbatim port of the source salon scroll-reveal: a framer-motion
 * useInView fade + directional slide + blur-in (once). Used across salon sections
 * for the on-scroll motion.
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
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });

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

  return (
    <motion.div
      ref={ref}
      initial="hidden"
      animate={isInView ? "visible" : "hidden"}
      variants={variants}
      className={className}
    >
      {children}
    </motion.div>
  );
}
