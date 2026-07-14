"use client";

import { Phone, MapPin, Clock, ImageIcon, Sparkles } from "lucide-react";
import type { BusinessFacts } from "@/lib/verticals/schema";
import { getVertical } from "@/lib/verticals/registry";
import { Chip } from "@/components/ui";

/**
 * Desktop side panel of the onboarding chat (P4): a wireframe of the future
 * site that fills in live as facts land in the conversation. Pure derivation
 * from `facts` — no requests, no state.
 */

function Shimmer({ w }: { w: string }) {
  return <div className={`h-3.5 animate-pulse rounded-full bg-line ${w}`} />;
}

function ContactRow({
  icon,
  value,
  placeholder,
}: {
  icon: React.ReactNode;
  value?: string;
  placeholder: string;
}) {
  const done = Boolean(value && value.trim());
  return (
    <div className={`flex items-center gap-2.5 text-[13px] ${done ? "text-ink" : "text-ink-faint"}`}>
      <span className={done ? "text-brand" : "text-line-strong"}>{icon}</span>
      <span className="truncate font-semibold">{done ? value : placeholder}</span>
    </div>
  );
}

export default function SitePreviewPanel({
  facts,
  verticalId,
  photosCount,
  hasLogo,
  className = "",
}: {
  facts: Partial<BusinessFacts>;
  verticalId?: string;
  photosCount: number;
  hasLogo: boolean;
  className?: string;
}) {
  const vertical = verticalId ? getVertical(verticalId) : null;
  const services = (facts.services ?? []).slice(0, 4);

  return (
    <aside className={`min-h-0 flex-col gap-4 overflow-y-auto border-l border-line bg-sunken/60 p-6 ${className}`}>
      <div>
        <h2 className="flex items-center gap-2 text-[15px] font-bold text-ink">
          <Sparkles size={15} className="text-honey" /> Ваш майбутній сайт
        </h2>
        <p className="mt-0.5 text-[13px] text-ink-muted">Заповнюється сам, поки ви розповідаєте.</p>
      </div>

      {/* Browser frame */}
      <div className="overflow-hidden rounded-[16px] border border-line bg-surface shadow-card">
        {/* Chrome bar */}
        <div className="flex items-center gap-2 border-b border-line bg-sunken px-3.5 py-2.5">
          <span className="flex gap-1.5">
            {["#f66", "#fc3", "#5c5"].map((c) => (
              <span key={c} className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: c }} />
            ))}
          </span>
          <span className="ml-1 flex-1 truncate rounded-full bg-surface px-3 py-1 text-[11px] font-semibold text-ink-faint">
            {facts.businessName?.trim() || "ваш-сайт"} · 3minsite
          </span>
        </div>

        {/* Hero */}
        <div className="flex flex-col items-start gap-2.5 bg-brand-soft/60 px-5 py-6">
          <div className="flex w-full items-center gap-2">
            <span
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                hasLogo ? "bg-honey text-white" : "bg-line text-ink-faint"
              }`}
            >
              {hasLogo ? "✓" : "L"}
            </span>
            {vertical && <Chip tone="honey">{vertical.label}</Chip>}
          </div>
          {facts.businessName?.trim() ? (
            <div className="text-[19px] font-bold leading-snug text-ink">{facts.businessName}</div>
          ) : (
            <Shimmer w="w-2/3" />
          )}
          {facts.city?.trim() ? (
            <div className="text-[13px] font-semibold text-ink-muted">{facts.city}</div>
          ) : (
            <Shimmer w="w-1/3" />
          )}
          <span className="mt-1 rounded-full bg-brand px-3.5 py-1.5 text-[12px] font-semibold text-white">
            Залишити заявку
          </span>
        </div>

        {/* Services */}
        <div className="flex flex-col gap-2 border-t border-line px-5 py-4">
          <span className="text-[11px] font-bold uppercase tracking-wide text-ink-faint">Послуги</span>
          {services.length > 0 ? (
            services.map((s, i) => (
              <div key={i} className="flex items-baseline justify-between gap-3 text-[13px]">
                <span className="truncate font-semibold text-ink">{s.name}</span>
                {s.price && <span className="shrink-0 font-bold text-brand">{s.price}</span>}
              </div>
            ))
          ) : (
            <>
              <Shimmer w="w-full" />
              <Shimmer w="w-3/4" />
            </>
          )}
        </div>

        {/* About */}
        {facts.about?.trim() && (
          <div className="border-t border-line px-5 py-4">
            <span className="text-[11px] font-bold uppercase tracking-wide text-ink-faint">Про нас</span>
            <p className="mt-1.5 line-clamp-3 text-[13px] leading-relaxed text-ink-muted">{facts.about}</p>
          </div>
        )}

        {/* Contacts */}
        <div className="flex flex-col gap-2 border-t border-line px-5 py-4">
          <span className="text-[11px] font-bold uppercase tracking-wide text-ink-faint">Контакти</span>
          <ContactRow icon={<Phone size={13} />} value={facts.phone} placeholder="Телефон" />
          <ContactRow icon={<MapPin size={13} />} value={facts.address} placeholder="Адреса" />
          <ContactRow icon={<Clock size={13} />} value={facts.hours} placeholder="Години роботи" />
        </div>

        {photosCount > 0 && (
          <div className="flex items-center gap-2 border-t border-line px-5 py-3 text-[13px] font-semibold text-ink-muted">
            <ImageIcon size={14} className="text-brand" /> {photosCount} фото додано
          </div>
        )}
      </div>

      <p className="text-[12px] leading-relaxed text-ink-faint">
        Це схема, не фінальний дизайн — справжній сайт збере AI із професійним оформленням.
      </p>
    </aside>
  );
}
