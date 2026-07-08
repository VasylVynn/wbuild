"use client";

import { useEffect } from "react";

/**
 * Tiny analytics beacon for tenant sites (current-cycle п.2): one `view` per
 * page load + delegated clicks on tel:/viber:/t.me links. Uses sendBeacon so it
 * never blocks navigation; silently no-ops on any failure. No personal data.
 */
export function Beacon() {
  useEffect(() => {
    const send = (kind: string) => {
      try {
        const payload = JSON.stringify({ kind, path: window.location.pathname });
        if (!navigator.sendBeacon?.("/api/events", new Blob([payload], { type: "application/json" }))) {
          void fetch("/api/events", { method: "POST", body: payload, keepalive: true, headers: { "Content-Type": "application/json" } });
        }
      } catch {
        /* analytics must never break the site */
      }
    };

    send("view");

    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a) return;
      const href = a.getAttribute("href") ?? "";
      if (href.startsWith("tel:")) send("tel_click");
      else if (href.startsWith("viber:") || href.includes("t.me/")) send("contact_click");
    };
    document.addEventListener("click", onClick, { capture: true });
    return () => document.removeEventListener("click", onClick, { capture: true });
  }, []);

  return null;
}
