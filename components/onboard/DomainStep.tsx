"use client";

import { useState } from "react";
import { checkDomainAction, requestDomainAction } from "@/app/app/new/domain-actions";
import type { DomainAvailability } from "@/lib/domains/rdap";
import { Button, Card, Chip, Input } from "@/components/ui";

/**
 * «Оберіть домен» — the last step of the paid funnel (spec 2026-08-05 §4),
 * shown right after a site goes live. The check is advisory: registration is
 * manual ops, so an ordered name is a promise («протягом ~4 годин»), never an
 * instant switch. Skipping is a first-class exit — the site already works on
 * its subdomain.
 */

const AVAILABILITY: Record<DomainAvailability, { tone: "ok" | "danger" | "neutral"; label: string }> = {
  available: { tone: "ok", label: "вільний" },
  taken: { tone: "danger", label: "зайнятий" },
  unknown: { tone: "neutral", label: "не вдалося перевірити — ми перевіримо вручну" },
};

export default function DomainStep({ host }: { host: string }) {
  const [value, setValue] = useState("");
  const [checked, setChecked] = useState<{ domain: string; available: DomainAvailability } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [ordered, setOrdered] = useState<string | null>(null);
  const [skipped, setSkipped] = useState(false);

  const check = async () => {
    if (busy || !value.trim()) return;
    setBusy(true);
    setError("");
    setChecked(null);
    try {
      const res = await checkDomainAction(value);
      if (res.ok) setChecked({ domain: res.domain, available: res.available });
      else setError(res.error);
    } finally {
      setBusy(false);
    }
  };

  // A "taken"/"unknown" name is still orderable on purpose: the operator checks
  // again at the registrar and calls back if it is really gone.
  const order = async () => {
    if (busy || !value.trim()) return;
    setBusy(true);
    setError("");
    try {
      const res = await requestDomainAction(host, value);
      if (res.ok) setOrdered(checked?.domain ?? value.trim());
      else setError(res.error);
    } finally {
      setBusy(false);
    }
  };

  if (skipped) return null;

  if (ordered) {
    return (
      <Card className="mt-4 w-full p-5 text-left">
        <div className="text-[16px] font-extrabold text-ink">Прийнято!</div>
        <p className="mt-1.5 text-[15px] leading-relaxed text-ink-muted">
          Сайт буде на вашому домені <span className="font-bold text-ink">{ordered}</span> протягом
          ~4 годин. Ми напишемо, коли все запрацює.
        </p>
      </Card>
    );
  }

  return (
    <Card className="mt-4 flex w-full flex-col gap-3 p-5 text-left">
      <div>
        <div className="text-[16px] font-extrabold text-ink">Оберіть власний домен</div>
        <div className="text-[14px] font-semibold leading-snug text-ink-muted">
          Він уже входить у вартість — на рік
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setChecked(null);
            setError("");
          }}
          onKeyDown={(e) => e.key === "Enter" && void check()}
          placeholder="mysite.com.ua"
          autoComplete="off"
          spellCheck={false}
          aria-label="Бажаний домен"
          className="flex-1"
        />
        <Button variant="secondary" size="md" disabled={busy || !value.trim()} onClick={() => void check()}>
          {busy ? "Перевіряю…" : "Перевірити"}
        </Button>
      </div>

      {checked && (
        <div className="flex flex-wrap items-center gap-2 text-[14px] font-semibold text-ink-muted">
          <span className="font-bold text-ink">{checked.domain}</span>
          <Chip tone={AVAILABILITY[checked.available].tone}>{AVAILABILITY[checked.available].label}</Chip>
        </div>
      )}
      {error && <p className="text-[14px] font-semibold text-danger">{error}</p>}

      <div className="flex flex-col gap-2">
        <Button size="md" disabled={busy || !value.trim()} onClick={() => void order()}>
          Замовити цей домен
        </Button>
        <Button variant="quiet" size="md" onClick={() => setSkipped(true)}>
          Поки залишити на піддомені
        </Button>
      </div>
    </Card>
  );
}
