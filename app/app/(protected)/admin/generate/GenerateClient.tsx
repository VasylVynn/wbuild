"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ROOT_DOMAIN } from "@/lib/config";
import {
  adminTestGenerate,
  adminDeleteTestSite,
  adminListTestSites,
  type TestSite,
} from "./actions";
import { Button, Card, Chip, ConfirmDialog, EmptyState } from "@/components/ui";

const isProd = process.env.NODE_ENV === "production";
const port = ROOT_DOMAIN.includes(":") ? `:${ROOT_DOMAIN.split(":")[1]}` : "";
const urlFor = (host: string) => `${isProd ? "https" : "http"}://${host}${isProd ? "" : port}`;

const linkSm =
  "text-[14px] font-bold text-ink-muted transition-colors hover:text-ink";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("uk-UA", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * One-click generation per vertical + list/delete of prior test sites. All
 * mutation goes through server actions in ./actions.ts (admin-gated there —
 * this component trusts nothing client-side).
 */
export default function GenerateClient({
  verticals,
  initialSites,
}: {
  verticals: { id: string; label: string }[];
  initialSites: TestSite[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState(verticals[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ url: string; editHost: string; ms: number } | null>(null);

  const [sites, setSites] = useState(initialSites);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const labelById = new Map(verticals.map((v) => [v.id, v.label]));

  async function generate() {
    if (!selected) return;
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const r = await adminTestGenerate(selected);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setResult(r);
      // `sites` was seeded from initialSites once — router.refresh() alone
      // won't reset it, so pull the fresh list explicitly.
      setSites(await adminListTestSites());
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function confirmDelete() {
    if (!confirmId) return;
    setDeleting(true);
    setDeleteError("");
    try {
      const r = await adminDeleteTestSite(confirmId);
      if (!r.ok) {
        setDeleteError(r.error);
        return;
      }
      setSites((prev) => prev.filter((s) => s.id !== confirmId));
      setConfirmId(null);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <Card className="flex flex-col gap-4 p-5">
        <div className="flex flex-wrap gap-2">
          {verticals.map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => setSelected(v.id)}
              className={`rounded-full px-4 py-2 text-[14px] font-bold transition-colors ${
                selected === v.id ? "bg-brand text-white" : "bg-sunken text-ink-muted hover:bg-line"
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>

        <Button onClick={generate} disabled={busy || !selected} className="self-start" size="md">
          {busy ? "Генерую… ~1 хв" : "Згенерувати"}
        </Button>

        {error && <p className="text-[14px] font-semibold text-danger">{error}</p>}

        {result && (
          <Card className="flex flex-col gap-2 bg-sunken p-4">
            <div className="flex flex-wrap items-center gap-3">
              <a
                href={result.url}
                target="_blank"
                rel="noopener noreferrer"
                className="font-bold text-brand hover:underline"
              >
                {result.url}
              </a>
              <Link href={`/edit/${encodeURIComponent(result.editHost)}`} className={linkSm}>
                Редагувати →
              </Link>
            </div>
            <p className="text-[13px] text-ink-faint">{(result.ms / 1000).toFixed(1)} с</p>
          </Card>
        )}
      </Card>

      <section>
        <h2 className="mb-3 font-brand text-[19px] font-medium text-ink">
          Тест-сайти <span className="text-ink-faint">({sites.length})</span>
        </h2>
        {sites.length === 0 ? (
          <EmptyState emoji="🧪" title="Ще немає тест-сайтів">
            Згенеруйте перший вище.
          </EmptyState>
        ) : (
          <ul className="flex flex-col gap-3">
            {sites.map((s) => (
              <li key={s.id}>
                <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <a
                      href={urlFor(s.host)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-bold text-brand hover:underline"
                    >
                      {s.host}
                    </a>
                    <Chip tone="neutral">{labelById.get(s.vertical) ?? s.vertical}</Chip>
                    <span className="text-[13px] font-semibold text-ink-faint">
                      {formatDate(s.created_at)}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Link href={`/edit/${encodeURIComponent(s.host)}`} className={linkSm}>
                      Редагувати
                    </Link>
                    <Button variant="danger" size="sm" onClick={() => setConfirmId(s.id)}>
                      Видалити
                    </Button>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
        {deleteError && <p className="mt-2 text-[14px] font-semibold text-danger">{deleteError}</p>}
      </section>

      <ConfirmDialog
        open={confirmId !== null}
        title="Видалити тест-сайт?"
        body="Сайт і всі його дані буде видалено безповоротно."
        confirmLabel="Видалити"
        onConfirm={confirmDelete}
        onCancel={() => setConfirmId(null)}
        busy={deleting}
      />
    </div>
  );
}
