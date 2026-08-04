"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { adminActivateDomainAction } from "./actions";
import { Button, Card, Chip, Field, Input } from "@/components/ui";

/**
 * Ops half of the domain flow (spec 2026-08-05 §4). The owner requested a name
 * in the funnel; a human bought it and pointed DNS at us; this switches the
 * tenant over. Registration and DNS stay outside the product — the button only
 * flips the DB and purges both hosts' caches.
 */
export default function DomainActivation({
  host,
  requestedDomain,
  currentDomain,
}: {
  host: string;
  requestedDomain?: string | null;
  currentDomain?: string | null;
}) {
  const router = useRouter();
  const [value, setValue] = useState(currentDomain ?? requestedDomain ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function activate() {
    setBusy(true);
    setError("");
    setDone(false);
    try {
      const result = await adminActivateDomainAction(host, value);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setDone(true);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="font-bold text-ink">{host}</span>
        {currentDomain ? (
          <Chip tone="ok">Активний: {currentDomain}</Chip>
        ) : requestedDomain ? (
          <Chip tone="warn">Замовлено: {requestedDomain}</Chip>
        ) : (
          <Chip tone="neutral">Домен не замовлено</Chip>
        )}
      </div>

      <Field label="Власний домен" error={error || undefined}>
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="example.com.ua"
          error={Boolean(error)}
          autoComplete="off"
          spellCheck={false}
        />
      </Field>

      <div className="flex flex-wrap items-center gap-3">
        <Button size="sm" disabled={busy || !value.trim()} onClick={() => void activate()}>
          Активувати домен
        </Button>
        {done && !error && (
          <span className="text-[13px] font-semibold text-ok">
            Домен активовано. Кеш очищено для обох адрес.
          </span>
        )}
      </div>

      <p className="text-[13px] text-ink-faint">
        Спершу зареєструйте домен і направте DNS на нас — ця кнопка лише перемикає сайт
        на нього.
      </p>
    </Card>
  );
}
