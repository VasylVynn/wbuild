"use client";

import { useState } from "react";
import { Check, Globe } from "lucide-react";
import { Chip, Sheet } from "@/components/ui";
import DomainStep from "@/components/onboard/DomainStep";

/**
 * The ₴999 custom domain, on the ONE surface an owner returns to.
 *
 * It used to have a single mount — the post-publish moment — and «поки залишити
 * на піддомені» there was final: no route in the product could offer it again,
 * so a skip was a lost sale for the lifetime of the site. Owner, live:
 * «в нас ніде нема ніякої інформації юзеру, що додайте свій платний домен».
 *
 * Three states, because they are three different sentences: a domain already
 * running, a domain ordered and being set up by hand (~4 hours), or nothing yet
 * — and only the last one is an offer.
 */
export default function DomainRow({
  host,
  status,
  customDomain,
  requestedDomain,
}: {
  host: string;
  status: string | null;
  customDomain: string | null;
  requestedDomain: string | null;
}) {
  const [open, setOpen] = useState(false);

  if (status === "active" && customDomain) {
    return (
      <Chip tone="ok">
        <Check size={12} /> {customDomain}
      </Chip>
    );
  }

  if (status === "requested") {
    return (
      <Chip tone="neutral">
        <Globe size={12} /> {requestedDomain ?? "домен"} — налаштовуємо
      </Chip>
    );
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex min-h-9 items-center gap-1.5 self-start rounded-full border border-line-strong bg-surface px-3 text-[13px] font-bold text-ink transition-colors hover:bg-sunken"
      >
        <Globe size={13} aria-hidden /> Власний домен — 999 грн
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Власний домен">
        <DomainStep host={host} onSkip={() => setOpen(false)} />
      </Sheet>
    </>
  );
}
