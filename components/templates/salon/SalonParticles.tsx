"use client";

import { motion } from "framer-motion";

const PARTICLE_COLORS = [
  "rgba(202, 138, 4, 0.6)",
  "rgba(236, 72, 153, 0.6)",
  "rgba(139, 92, 246, 0.6)",
  "rgba(255, 20, 147, 0.5)",
  "rgba(0, 255, 255, 0.5)",
];

/*
 * Rising particles — port of the source `Particles`. The source seeds size /
 * color / position / timing with `Math.random()` inside a `useState`
 * initializer, which causes an SSR hydration mismatch here. Replaced with a
 * fixed preset array of 15 entries (same shape/range as the source) so
 * server and client render identically.
 */
const PARTICLES = [
  { size: 3.2, color: PARTICLE_COLORS[0], delay: 0.2, duration: 14, left: "6%", top: "82%" },
  { size: 4.6, color: PARTICLE_COLORS[1], delay: 1.8, duration: 18, left: "14%", top: "35%" },
  { size: 2.4, color: PARTICLE_COLORS[2], delay: 3.4, duration: 11, left: "22%", top: "64%" },
  { size: 3.8, color: PARTICLE_COLORS[3], delay: 0.6, duration: 16, left: "30%", top: "18%" },
  { size: 2.9, color: PARTICLE_COLORS[4], delay: 2.5, duration: 13, left: "38%", top: "90%" },
  { size: 4.1, color: PARTICLE_COLORS[0], delay: 4.1, duration: 19, left: "46%", top: "48%" },
  { size: 2.6, color: PARTICLE_COLORS[1], delay: 1.1, duration: 12, left: "54%", top: "72%" },
  { size: 3.5, color: PARTICLE_COLORS[2], delay: 3.9, duration: 17, left: "62%", top: "28%" },
  { size: 4.9, color: PARTICLE_COLORS[3], delay: 0.9, duration: 15, left: "70%", top: "58%" },
  { size: 2.2, color: PARTICLE_COLORS[4], delay: 2.9, duration: 10, left: "78%", top: "84%" },
  { size: 3.3, color: PARTICLE_COLORS[0], delay: 4.6, duration: 20, left: "86%", top: "40%" },
  { size: 4.4, color: PARTICLE_COLORS[1], delay: 1.4, duration: 14, left: "92%", top: "66%" },
  { size: 2.8, color: PARTICLE_COLORS[2], delay: 3.1, duration: 18, left: "10%", top: "12%" },
  { size: 3.9, color: PARTICLE_COLORS[3], delay: 0.4, duration: 11, left: "58%", top: "8%" },
  { size: 4.2, color: PARTICLE_COLORS[4], delay: 2.2, duration: 16, left: "82%", top: "20%" },
];

export default function SalonParticles() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {PARTICLES.map((p, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{
            width: p.size,
            height: p.size,
            background: p.color,
            left: p.left,
            top: p.top,
            willChange: "transform, opacity",
          }}
          initial={{ opacity: 0, y: 0 }}
          animate={{
            opacity: [0, 0.4, 0.4, 0],
            y: -800,
          }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            repeat: Infinity,
            ease: "linear",
          }}
        />
      ))}
    </div>
  );
}
