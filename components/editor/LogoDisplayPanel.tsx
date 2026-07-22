"use client";

import { useEffect, useState } from "react";
import {
  getLogoAction,
  setLogoDisplayAction,
} from "@/app/app/(protected)/edit/logo-actions";

/*
 * «Оригінал / Адаптоване» (H1): the owner's review tool for the palette-adapted
 * logo variant. Self-contained: loads its own state (adapted URL + current
 * pick) so the host sheet only mounts it; renders nothing when there is no
 * adapted variant. The checkerboard backdrop makes transparent PNGs readable
 * regardless of the template's nav color.
 */

const CHECKER: React.CSSProperties = {
  backgroundImage:
    "linear-gradient(45deg,#e5e5e5 25%,transparent 25%,transparent 75%,#e5e5e5 75%)," +
    "linear-gradient(45deg,#e5e5e5 25%,transparent 25%,transparent 75%,#e5e5e5 75%)",
  backgroundSize: "12px 12px",
  backgroundPosition: "0 0, 6px 6px",
  backgroundColor: "#fff",
};

export default function LogoDisplayPanel({
  host,
  logoUrl,
}: {
  host: string;
  /** Current original logo — re-syncs the panel when the owner swaps the file. */
  logoUrl?: string;
}) {
  const [adaptedUrl, setAdaptedUrl] = useState<string | undefined>(undefined);
  const [display, setDisplay] = useState<"original" | "adapted">("adapted");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await getLogoAction(host);
        if (!cancelled && res.ok) {
          setAdaptedUrl(res.logoAdaptedUrl);
          setDisplay(res.logoDisplay ?? "adapted");
        }
      } catch {
        // Non-fatal: no panel is rendered without loaded state.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [host, logoUrl]);

  if (!logoUrl || !adaptedUrl) return null;

  const pick = async (mode: "original" | "adapted") => {
    if (busy || mode === display) return;
    setBusy(true);
    const prev = display;
    setDisplay(mode);
    try {
      const res = await setLogoDisplayAction(host, mode);
      if (!res.ok) setDisplay(prev);
    } catch {
      setDisplay(prev);
    } finally {
      setBusy(false);
    }
  };

  const options = [
    { mode: "original" as const, url: logoUrl, label: "Оригінал" },
    { mode: "adapted" as const, url: adaptedUrl, label: "Адаптоване" },
  ];

  return (
    <div className="mt-5">
      <p className="mb-1 text-[14px] font-medium">Версія лого на сайті</p>
      <p className="mb-3 text-[13px] leading-relaxed text-ink-muted">
        Ми адаптували лого під кольори вашого дизайну. Оберіть, яку версію показувати — оригінал
        завжди зберігається.
      </p>
      <div className="grid grid-cols-2 gap-3">
        {options.map((o) => (
          <button
            key={o.mode}
            type="button"
            disabled={busy}
            onClick={() => void pick(o.mode)}
            aria-pressed={display === o.mode}
            className={`rounded-lg border-2 p-2 text-center transition-colors ${
              display === o.mode
                ? "border-brand"
                : "border-transparent hover:border-ink-muted/30"
            }`}
          >
            <span
              className="mb-1.5 flex h-14 items-center justify-center overflow-hidden rounded"
              style={CHECKER}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={o.url} alt={o.label} className="max-h-10 w-auto max-w-full" />
            </span>
            <span className="text-[13px]">{o.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
