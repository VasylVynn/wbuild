"use client";

import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { Logo } from "./Logo";

/**
 * Marketing top bar: transparent over the hero, then a hairline + blurred
 * canvas once the page scrolls. Anchors only — the two real destinations
 * (`newUrl`, `loginUrl`) live on the dashboard host and are resolved on the
 * server, so this component never touches lib/config.
 */
const nav = [
  { label: "Як це працює", href: "#how" },
  { label: "Приклади", href: "#examples" },
  { label: "Можливості", href: "#features" },
  { label: "Питання", href: "#faq" },
];

export function SiteHeader({ newUrl, loginUrl }: { newUrl: string; loginUrl: string }) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 border-b transition-all duration-300 ${
        scrolled ? "border-line bg-canvas/80 backdrop-blur-xl" : "border-transparent"
      }`}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3.5 sm:px-6">
        <Logo href="/" />

        <nav className="hidden items-center gap-1 md:flex">
          {nav.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="rounded-full px-3.5 py-2 text-[14px] font-medium text-ink-muted transition-colors hover:bg-sunken hover:text-ink"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <a
            href={loginUrl}
            className="inline-flex min-h-11 items-center justify-center rounded-full px-4 font-ui text-[15px] font-semibold text-ink-muted transition-colors hover:bg-sunken hover:text-ink"
          >
            Увійти
          </a>
          <a
            href={newUrl}
            className="inline-flex min-h-11 items-center justify-center rounded-full bg-brand px-5 font-ui text-[15px] font-semibold text-white transition-colors hover:bg-brand-hover"
          >
            Створити сайт
          </a>
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex h-10 w-10 items-center justify-center rounded-full text-ink transition-colors hover:bg-sunken md:hidden"
          aria-label={open ? "Закрити меню" : "Відкрити меню"}
          aria-expanded={open}
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {open && (
        <div className="animate-rise border-t border-line bg-canvas/95 px-4 pb-4 pt-2 backdrop-blur-xl md:hidden">
          <nav className="flex flex-col">
            {nav.map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="rounded-xl px-3 py-3 text-[16px] font-medium text-ink transition-colors hover:bg-sunken"
              >
                {item.label}
              </a>
            ))}
          </nav>
          <div className="mt-2 flex flex-col gap-2">
            <a
              href={loginUrl}
              className="inline-flex min-h-12 w-full items-center justify-center rounded-full border-[1.5px] border-line-strong bg-surface font-ui text-[16px] font-semibold text-ink"
            >
              Увійти
            </a>
            <a
              href={newUrl}
              className="inline-flex min-h-12 w-full items-center justify-center rounded-full bg-brand font-ui text-[16px] font-semibold text-white"
            >
              Створити сайт
            </a>
          </div>
        </div>
      )}
    </header>
  );
}
