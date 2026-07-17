"use client";

import { motion } from "framer-motion";
import { createContext, useContext, type ReactNode } from "react";
import { useRevealGate } from "../shared/reveal";

/*
 * Reveal — ferri's scroll-triggered fade+lift (once), staggered container and
 * items. Motion values are the verbatim ferri port; the reveal itself is gated
 * behind useRevealGate (H5): SSR markup is fully visible, only below-the-fold
 * elements arm the animation after hydration.
 */

interface RevealProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  y?: number;
}

export function Reveal({ children, className, delay = 0, y = 32 }: RevealProps) {
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
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// RevealItem must render plain (visible) markup whenever its parent stagger
// container is not armed — the pair coordinates through this context.
const StaggerArmedContext = createContext(false);

export function RevealStagger({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
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
    <StaggerArmedContext.Provider value={true}>
      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-40px" }}
        variants={{ visible: { transition: { staggerChildren: 0.1 } } }}
        className={className}
      >
        {children}
      </motion.div>
    </StaggerArmedContext.Provider>
  );
}

export function RevealItem({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const armed = useContext(StaggerArmedContext);
  if (!armed) {
    return <div className={className}>{children}</div>;
  }
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 24 },
        visible: {
          opacity: 1,
          y: 0,
          transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] },
        },
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
