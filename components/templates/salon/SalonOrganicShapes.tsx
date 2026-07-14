"use client";

import { motion } from "framer-motion";

/*
 * Floating orbs — port of the source `OrganicShapes`. The source seeds size /
 * position / duration with `Math.random()` inside a `useState` initializer,
 * which is fine client-side-only but causes an SSR hydration mismatch here.
 * Replaced with a fixed preset array (same shape/range as the source) so
 * server and client render identically.
 */
const ORBS = [
  { size: 92, left: "18%", top: "22%", background: "rgba(202, 138, 4, 0.1)", duration: 24 },
  { size: 64, left: "72%", top: "58%", background: "rgba(236, 72, 153, 0.1)", duration: 28 },
  { size: 110, left: "45%", top: "78%", background: "rgba(202, 138, 4, 0.1)", duration: 22 },
];

export default function SalonOrganicShapes() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {ORBS.map((orb, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{
            width: orb.size,
            height: orb.size,
            left: orb.left,
            top: orb.top,
            background: orb.background,
            filter: "blur(20px)",
            willChange: "transform, opacity",
          }}
          animate={{
            y: [0, -40, 0],
            x: [0, 30, 0],
            scale: [1, 1.1, 1],
            opacity: [0.05, 0.1, 0.05],
          }}
          transition={{
            duration: orb.duration,
            repeat: Infinity,
            ease: "easeInOut",
            delay: i * 2,
          }}
        />
      ))}
    </div>
  );
}
