"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, Globe, Inbox, ShieldCheck, Plus, LogOut } from "lucide-react";
import { Wordmark } from "@/components/ui";

/**
 * Persistent product chrome (P1): fixed left sidebar on desktop, top bar +
 * bottom nav on mobile. Wraps dashboard/sites/leads/admin — the editor keeps
 * its own chrome. `signOut` is a server action passed down from the server
 * layout.
 */

interface NavItem {
  href: string;
  label: string;
  /** Shorter label for the mobile bottom nav. */
  short: string;
  icon: typeof Globe;
  exact?: boolean;
}

const NAV: NavItem[] = [
  { href: "/", label: "Панель", short: "Панель", icon: LayoutGrid, exact: true },
  { href: "/sites", label: "Мої сайти", short: "Сайти", icon: Globe },
  { href: "/leads", label: "Заявки", short: "Заявки", icon: Inbox },
];

const ADMIN: NavItem = { href: "/admin", label: "Адмінка", short: "Адмінка", icon: ShieldCheck };

function isActive(pathname: string, item: NavItem): boolean {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export default function AppShell({
  email,
  admin,
  signOut,
  children,
}: {
  email: string | null;
  admin: boolean;
  signOut: () => Promise<void>;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const items = admin ? [...NAV, ADMIN] : NAV;

  return (
    <div className="min-h-screen bg-canvas lg:pl-60">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-line bg-surface px-3 py-4 lg:flex">
        <Link href="/" className="px-2 py-1">
          <Wordmark />
        </Link>

        <Link
          href="/new"
          className="mt-5 flex min-h-[44px] items-center justify-center gap-2 rounded-full bg-brand px-4 text-[14px] font-semibold text-white transition-colors hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-honey-deep focus-visible:ring-offset-2"
        >
          <Plus size={16} /> Створити сайт
        </Link>

        <nav className="mt-5 flex flex-1 flex-col gap-1">
          {items.map((item) => {
            const active = isActive(pathname, item);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-3 rounded-[14px] px-3 py-2.5 text-[14px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-honey-deep ${
                  active ? "bg-honey/20 text-ink" : "text-ink-muted hover:bg-sunken hover:text-ink"
                }`}
              >
                <Icon size={18} className={`shrink-0 ${active ? "text-honey-text" : ""}`} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-line px-2 pt-3">
          <p className="truncate text-[12px] font-semibold text-ink-faint">{email ?? "Гість"}</p>
          <form action={signOut} className="mt-1">
            <button
              type="submit"
              className="flex w-full items-center gap-3 rounded-[14px] px-1 py-2 text-[14px] font-semibold text-ink-muted transition-colors hover:bg-sunken hover:text-ink"
            >
              <LogOut size={17} className="shrink-0" /> Вийти
            </button>
          </form>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-40 flex items-center justify-between gap-3 border-b border-line bg-surface/95 px-4 py-3 backdrop-blur lg:hidden">
        <Link href="/">
          <Wordmark />
        </Link>
        <div className="flex min-w-0 items-center gap-2">
          <span className="hidden max-w-[160px] truncate text-[12px] font-semibold text-ink-faint sm:block">
            {email ?? "Гість"}
          </span>
          <Link
            href="/new"
            className="flex min-h-[38px] items-center gap-1.5 rounded-full bg-brand px-3.5 text-[13px] font-semibold text-white transition-colors hover:bg-brand-hover"
          >
            <Plus size={15} /> Створити
          </Link>
          <form action={signOut}>
            <button
              type="submit"
              aria-label="Вийти"
              title={email ? `Вийти — ${email}` : "Вийти"}
              className="flex h-10 w-10 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-sunken hover:text-ink"
            >
              <LogOut size={17} />
            </button>
          </form>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 pb-28 pt-6 sm:px-6 lg:px-10 lg:pb-12 lg:pt-10">
        {children}
      </main>

      {/* Mobile bottom nav */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 flex items-stretch justify-around gap-1 border-t border-line bg-surface/95 px-2 pt-2 backdrop-blur lg:hidden"
        style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}
      >
        {items.map((item) => {
          const active = isActive(pathname, item);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`flex flex-1 flex-col items-center gap-1 rounded-[14px] py-1 text-[11px] font-semibold transition-colors ${
                active ? "text-ink" : "text-ink-muted"
              }`}
            >
              <span
                className={`flex h-8 w-14 items-center justify-center rounded-full transition-colors ${
                  active ? "bg-honey/25 text-honey-text" : ""
                }`}
              >
                <Icon size={19} />
              </span>
              {item.short}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
