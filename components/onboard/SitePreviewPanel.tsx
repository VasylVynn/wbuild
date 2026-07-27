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
  return <div className={`shimmer h-3.5 rounded-full ${w}`} />;
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
      <span className={done ? "text-honey" : "text-line-strong"}>{icon}</span>
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
    <aside
      className={`min-h-0 flex-col gap-5 overflow-y-auto border-l border-line bg-sunken/60 p-6 ${className}`}
      /* Warm honey halo behind the device frame — the reference's ambient glow.
         Painted as a background image so nothing absolute can shift the frame. */
      style={{
        backgroundImage:
          "radial-gradient(circle at 50% 8%, oklch(0.86 0.14 82 / 0.3) 0%, transparent 62%)",
      }}
    >
      <div className="text-center">
        <h2 className="flex items-center justify-center gap-2 text-[13px] font-bold text-ink-muted">
          <Sparkles size={15} className="text-honey" /> Живий попередній перегляд
        </h2>
        <p className="mt-1 text-[13px] text-ink-faint">Заповнюється сам, поки ви розповідаєте.</p>
      </div>

      {/* Browser frame */}
      <div className="rounded-[26px] border border-line bg-surface p-2 shadow-[0_28px_60px_-28px_rgba(51,41,28,0.38)]">
        <div className="overflow-hidden rounded-[19px] border border-line bg-surface">
          {/* Chrome bar */}
          <div className="flex items-center gap-2 border-b border-line bg-sunken px-3.5 py-2.5">
            <span className="flex gap-1.5">
              {["#E6A5A0", "#EFC776", "#A9C9A4"].map((c) => (
                <span key={c} className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: c }} />
              ))}
            </span>
            <span className="ml-1 flex-1 truncate rounded-full bg-surface px-3 py-1 text-[11px] font-semibold text-ink-faint">
              {facts.businessName?.trim() || "ваш-сайт"} · 3minsite
            </span>
          </div>

          {/* Hero */}
          <div className="flex flex-col items-start gap-2.5 bg-gradient-to-b from-honey/25 to-transparent px-5 py-6">
            <div className="flex w-full items-center gap-2">
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                  hasLogo ? "bg-honey text-honey-text" : "bg-line text-ink-faint"
                }`}
              >
                {hasLogo ? "✓" : "L"}
              </span>
              {vertical && <Chip tone="honey" className="shrink-0">{vertical.label}</Chip>}
            </div>
            {facts.businessName?.trim() ? (
              <div className="font-brand text-[19px] font-semibold leading-snug text-ink">
                {facts.businessName}
              </div>
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
                  {s.price && <span className="shrink-0 font-bold text-honey-text">{s.price}</span>}
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
              <ImageIcon size={14} className="text-honey" /> {photosCount} фото додано
            </div>
          )}
        </div>
      </div>

      <p className="text-center text-[12px] leading-relaxed text-ink-faint">
        Це схема, не фінальний дизайн — справжній сайт збере AI із професійним оформленням.
      </p>
    </aside>
  );
}
