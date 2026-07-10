import Link from "next/link";
import { notFound } from "next/navigation";
import { isPlatformAdmin } from "@/lib/admin";
import { verticals } from "@/lib/verticals/registry";
import { adminListTestSites } from "./actions";
import GenerateClient from "./GenerateClient";

/**
 * Founders-only test-site generator (gated by lib/admin.ts, fail-closed).
 * One click per vertical → generateAndPublish() with a realistic fixture, no
 * onboarding chat — for iterating on generation quality. maxDuration covers
 * generation (~35-60s) running through this page's server actions.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export default async function AdminGeneratePage() {
  if (!(await isPlatformAdmin())) notFound();

  const sites = await adminListTestSites();
  const verticalList = Object.values(verticals).map((v) => ({ id: v.id, label: v.label }));

  return (
    <main className="mx-auto min-h-screen max-w-3xl bg-canvas px-6 py-12">
      <div className="mb-8">
        <Link
          href="/admin"
          className="text-[14px] font-bold text-ink-muted transition-colors hover:text-ink"
        >
          ← Адмінка
        </Link>
        <h1 className="mt-1.5 font-brand text-[24px] font-medium text-ink">Тест-генерація</h1>
      </div>

      <GenerateClient verticals={verticalList} initialSites={sites} />
    </main>
  );
}
