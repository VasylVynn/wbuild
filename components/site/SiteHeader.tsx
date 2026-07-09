import Link from "next/link";
import type { Tenant, NavItem } from "@/lib/tenant/types";

/**
 * Shared header for a tenant site. Brand + projected nav (§5.3). Colors/fonts
 * come from the tenant theme via CSS variables set on the shell wrapper.
 */
export function SiteHeader({ tenant, nav }: { tenant: Tenant; nav: NavItem[] }) {
  return (
    <header
      className="sticky top-0 z-50 border-b"
      style={{ backgroundColor: "var(--color-background)", borderColor: "var(--color-muted)" }}
    >
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link
          href="/"
          className="flex items-center gap-2.5 text-xl font-bold tracking-tight"
          style={{ fontFamily: "var(--font-heading)", color: "var(--color-primary)" }}
        >
          {tenant.brand.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={tenant.brand.logoUrl}
              alt={tenant.brand.businessName}
              className="h-9 w-auto max-w-[120px] rounded-md object-contain"
            />
          )}
          <span>{tenant.brand.businessName}</span>
        </Link>
        {nav.length > 0 && (
          <nav className="hidden gap-6 sm:flex">
            {nav.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="text-sm font-medium transition-opacity hover:opacity-70"
                style={{ color: "var(--color-foreground)" }}
              >
                {item.label}
              </a>
            ))}
          </nav>
        )}
      </div>
    </header>
  );
}
