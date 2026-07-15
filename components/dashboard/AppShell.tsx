"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Globe,
  Inbox,
  ShieldCheck,
  Plus,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { Wordmark } from "@/components/ui";

/**
 * Persistent product chrome (P1): fixed left sidebar on desktop, top bar with
 * a slide-down menu on mobile. Wraps dashboard/sites/leads/admin — the editor
 * keeps its own chrome. `signOut` is a server action passed down from the
 * server layout.
 */

interface NavItem {
  href: string;
  label: string;
  icon: typeof Globe;
  exact?: boolean;
}

const NAV: NavItem[] = [
  { href: "/", label: "Панель", icon: LayoutDashboard, exact: true },
  { href: "/sites", label: "Мої сайти", icon: Globe },
  { href: "/leads", label: "Заявки", icon: Inbox },
];

function isActive(pathname: string, item: NavItem): boolean {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

function NavLink({
  item,
  active,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={`flex items-center gap-3 rounded-[12px] px-3 py-2.5 text-[15px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
        active ? "bg-brand-soft text-brand" : "text-ink-muted hover:bg-sunken hover:text-ink"
      }`}
    >
      <Icon size={18} className="shrink-0" />
      {item.label}
    </Link>
  );
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
  const [menuOpen, setMenuOpen] = useState(false);
  const close = () => setMenuOpen(false);

  const nav = (onNavigate?: () => void) => (
    <>
      {NAV.map((item) => (
        <NavLink key={item.href} item={item} active={isActive(pathname, item)} onNavigate={onNavigate} />
      ))}
      {admin && (
        <NavLink
          item={{ href: "/admin", label: "Адмінка", icon: ShieldCheck }}
          active={isActive(pathname, { href: "/admin", label: "", icon: ShieldCheck })}
          onNavigate={onNavigate}
        />
      )}
    </>
  );

  const userBlock = (
    <div className="flex items-center justify-between gap-2 border-t border-line px-3 pt-3">
      <span className="min-w-0 truncate text-[13px] font-semibold text-ink-faint">{email ?? "Гість"}</span>
      <form action={signOut}>
        <button
          type="submit"
          title="Вийти"
          className="flex h-9 w-9 items-center justify-center rounded-[10px] text-ink-muted transition-colors hover:bg-sunken hover:text-ink"
        >
          <LogOut size={16} />
        </button>
      </form>
    </div>
  );

  return (
    <div className="min-h-screen bg-canvas lg:pl-60">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col gap-4 border-r border-line bg-surface px-4 py-5 lg:flex">
        <Link href="/" className="px-2">
          <Wordmark />
        </Link>
        <Link
          href="/new"
          className="flex min-h-[40px] items-center justify-center gap-2 rounded-[12px] bg-brand px-4 text-[14px] font-semibold text-white transition-colors hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
        >
          <Plus size={16} /> Створити сайт
        </Link>
        <nav className="flex flex-1 flex-col gap-1">{nav()}</nav>
        {userBlock}
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-40 border-b border-line bg-surface lg:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <Link href="/" onClick={close}>
            <Wordmark />
          </Link>
          <button
            type="button"
            aria-label={menuOpen ? "Закрити меню" : "Меню"}
            onClick={() => setMenuOpen((v) => !v)}
            className="flex h-10 w-10 items-center justify-center rounded-[10px] text-ink transition-colors hover:bg-sunken"
          >
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
        {menuOpen && (
          <div className="flex flex-col gap-1 border-t border-line px-4 pb-4 pt-2">
            <Link
              href="/new"
              onClick={close}
              className="mb-1 flex min-h-[40px] items-center justify-center gap-2 rounded-[12px] bg-brand px-4 text-[14px] font-semibold text-white transition-colors hover:bg-brand-hover"
            >
              <Plus size={16} /> Створити сайт
            </Link>
            {nav(close)}
            {userBlock}
          </div>
        )}
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-10 lg:py-10">{children}</main>
    </div>
  );
}
