import type { Tenant } from "@/lib/tenant/types";

/** Shared footer for a tenant site — contacts drawn from tenant config (§5.1). */
export function SiteFooter({ tenant }: { tenant: Tenant }) {
  const { footer, brand } = tenant;
  return (
    <footer className="mt-20 border-t" style={{ borderColor: "var(--color-muted)" }}>
      <div
        className="mx-auto max-w-5xl px-4 py-12 text-sm"
        style={{ color: "var(--color-foreground)" }}
      >
        <div
          className="text-lg font-bold"
          style={{ fontFamily: "var(--font-heading)", color: "var(--color-primary)" }}
        >
          {brand.businessName}
        </div>
        <div className="mt-4 space-y-1 opacity-80">
          {footer.address && <div>{footer.address}</div>}
          {footer.phone && (
            <div>
              <a href={`tel:${footer.phone}`} className="hover:opacity-70">
                {footer.phone}
              </a>
            </div>
          )}
          {footer.hours && <div>{footer.hours}</div>}
        </div>
        {footer.social && footer.social.length > 0 && (
          <div className="mt-4 flex gap-4">
            {footer.social.map((s) => (
              <a key={s.href} href={s.href} className="underline hover:opacity-70">
                {s.label}
              </a>
            ))}
          </div>
        )}
        <div className="mt-8 opacity-60">{footer.copyright ?? `© ${brand.businessName}`}</div>
      </div>
    </footer>
  );
}
