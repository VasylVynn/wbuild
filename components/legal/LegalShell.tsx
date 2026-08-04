import type { ReactNode } from "react";
import Link from "next/link";
import { Logo } from "@/components/landing/Logo";

/**
 * Chrome + typography for the two static legal pages (/oferta, /privacy).
 * Deliberately plainer than the landing sections: no Reveal animation, no
 * gradients — these are documents a WayForPay reviewer and a customer read,
 * so legibility beats atmosphere. Server components, light theme, Ukrainian.
 */
export function LegalShell({
  title,
  intro,
  edition,
  children,
}: {
  title: string;
  intro?: string;
  edition: string;
  children: ReactNode;
}) {
  return (
    <main className="min-h-screen bg-canvas text-ink">
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Logo href="/" />
          <Link
            href="/"
            className="text-[14px] font-semibold text-ink-muted transition-colors hover:text-ink"
          >
            На головну
          </Link>
        </div>
      </header>

      <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
        <h1 className="text-balance font-brand text-[28px] font-semibold leading-tight tracking-tight sm:text-[36px]">
          {title}
        </h1>
        <p className="mt-3 text-[13px] font-semibold text-ink-faint">{edition}</p>
        {intro && <p className="mt-5 text-[16px] leading-relaxed text-ink-muted">{intro}</p>}
        <div className="mt-10 flex flex-col gap-9">{children}</div>
      </article>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-4 px-4 py-8 sm:px-6">
          <nav className="flex flex-wrap gap-x-6 gap-y-2 text-[14px] text-ink-muted">
            <Link href="/oferta" className="transition-colors hover:text-ink">
              Публічна оферта
            </Link>
            <Link href="/privacy" className="transition-colors hover:text-ink">
              Політика конфіденційності
            </Link>
          </nav>
          <p className="text-[12px] text-ink-faint">© 2026 3minsite. Зроблено в Україні.</p>
        </div>
      </footer>
    </main>
  );
}

/** One numbered clause of a legal document. */
export function Clause({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="font-brand text-[19px] font-semibold leading-snug tracking-tight text-ink sm:text-[21px]">
        {n}. {title}
      </h2>
      <div className="mt-3 flex flex-col gap-3 text-[15px] leading-relaxed text-ink-muted sm:text-[16px]">
        {children}
      </div>
    </section>
  );
}

/** Bulleted list inside a clause. */
export function Items({ items }: { items: ReactNode[] }) {
  return (
    <ul className="flex flex-col gap-2">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2.5">
          <span aria-hidden className="mt-[0.6em] h-1.5 w-1.5 shrink-0 rounded-full bg-honey" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * A value the owner MUST replace before go-live (FOP requisites, contacts).
 * Visually loud on purpose — an unfilled placeholder shipping to production is
 * a legal problem, so it must be impossible to miss on the live page.
 */
export function Blank({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-md bg-warn-soft px-1.5 py-0.5 font-semibold text-warn">
      [{children}]
    </span>
  );
}
