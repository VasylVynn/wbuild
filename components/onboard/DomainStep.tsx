"use client";

import { useEffect, useRef, useState } from "react";
import { checkDomainAction, requestDomainAction } from "@/app/app/new/domain-actions";
import type { DomainAvailability } from "@/lib/domains/rdap";
import { Button, Card, Chip, Input } from "@/components/ui";
import { usePaywallCheckout, PRICE_UAH } from "@/components/pay/usePaywallCheckout";
import { phCapture } from "@/components/analytics/PostHogProvider";
import { rootSiteUrl } from "@/lib/config";

/**
 * «Власний домен» — THE paid step (owner decision 2026-08-06). The site is
 * already live and free on its subdomain; ₴999 buys the owner's own name plus a
 * year of running it. So the payment panel lives inside this card: order →
 * server answers `paymentRequired` → pay in a second tab → the confirmed order
 * re-submits the same request automatically.
 *
 * The availability check is advisory and registration is manual ops, so an
 * ordered name is a promise («протягом ~4 годин»), never an instant switch.
 * Skipping is a first-class exit — the site already works.
 */

const AVAILABILITY: Record<DomainAvailability, { tone: "ok" | "danger" | "neutral"; label: string }> = {
  available: { tone: "ok", label: "вільний" },
  taken: { tone: "danger", label: "зайнятий" },
  unknown: { tone: "neutral", label: "не вдалося перевірити — ми перевіримо вручну" },
};

export default function DomainStep({
  host,
  /** What «skip» means to whoever mounted this. Absent → the card collapses in
   *  place (its original home was a page). Given → skipping is an exit from the
   *  surface around it, so the card must not ALSO leave a second dismissal
   *  behind: the post-publish sheet closes instead. */
  onSkip,
}: {
  host: string;
  onSkip?: () => void;
}) {
  const [value, setValue] = useState("");
  const [checked, setChecked] = useState<{ domain: string; available: DomainAvailability } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [ordered, setOrdered] = useState<string | null>(null);
  const [skipped, setSkipped] = useState(false);
  // The server sends the real amount with its paywall refusal; PRICE_UAH is only
  // what we show before that answer arrives.
  const [price, setPrice] = useState(PRICE_UAH);
  const [payRequired, setPayRequired] = useState(false);

  const check = async () => {
    if (busy || !value.trim()) return;
    setBusy(true);
    setError("");
    setChecked(null);
    try {
      const res = await checkDomainAction(value);
      if (res.ok) {
        setChecked({ domain: res.domain, available: res.available });
        // The verdict, never the name the owner typed — that is their business's
        // identity, and «скільки людей побачили „зайнятий“» is the whole question.
        phCapture("ui_domain_check", { available: res.available });
      } else setError(res.error);
    } finally {
      setBusy(false);
    }
  };

  // A "taken"/"unknown" name is still orderable on purpose: the operator checks
  // again at the registrar and calls back if it is really gone.
  //
  // Split from the click handler so the paywall can re-run exactly this after a
  // confirmed payment. Reads `value`/`checked` from the current render — the
  // hook keeps the latest closure, so a name edited mid-payment still applies.
  const submit = async () => {
    setError("");
    const res = await requestDomainAction(host, value);
    if (res.ok) {
      setPayRequired(false);
      setOrdered(checked?.domain ?? value.trim());
      // `checked` is null when the owner ordered without checking first —
      // which is itself the interesting half of this step.
      phCapture("ui_domain_requested", {
        host,
        ...(checked ? { available: checked.available } : { available: "unchecked" }),
      });
      return;
    }
    if (res.paymentRequired) {
      if (res.price) setPrice(res.price);
      setPayRequired(true);
      return;
    }
    setError(res.error);
  };

  const order = async () => {
    if (busy || !value.trim()) return;
    setBusy(true);
    try {
      await submit();
    } finally {
      setBusy(false);
    }
  };

  // WayForPay in a second tab; the signed callback flips the order, and the
  // domain request the owner already made is simply re-sent.
  const paywall = usePaywallCheckout({ host, surface: "domain", onPaid: submit });

  // «Saw the offer», once per session: the panel appears and disappears as the
  // owner edits the name, and that is one owner deciding once, not several. The
  // checkout events it leads to live in usePaywallCheckout.
  const paywallShown = useRef(false);
  useEffect(() => {
    if (!payRequired || paywallShown.current) return;
    paywallShown.current = true;
    phCapture("ui_paywall_shown", { surface: "domain", host });
  }, [payRequired, host]);

  if (skipped) return null;

  if (ordered) {
    return (
      <Card className="mt-4 w-full p-5 text-left">
        <div className="text-[16px] font-extrabold text-ink">Прийнято!</div>
        <p className="mt-1.5 text-[15px] leading-relaxed text-ink-muted">
          Сайт буде на вашому домені <span className="font-bold text-ink">{ordered}</span> протягом
          ~4 годин. Ми напишемо, коли все запрацює.
        </p>
      </Card>
    );
  }

  const awaiting = paywall.status === "awaiting";
  const paid = paywall.status === "paid";
  const payFailed = paywall.status === "failed" || paywall.status === "error";

  return (
    <Card className="mt-4 flex w-full flex-col gap-3 p-5 text-left">
      <div>
        <div className="text-[16px] font-extrabold text-ink">Хочете власний домен?</div>
        <div className="text-[14px] font-semibold leading-snug text-ink-muted">
          {price} грн — домен + рік обслуговування
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setChecked(null);
            setError("");
          }}
          onKeyDown={(e) => e.key === "Enter" && void check()}
          placeholder="mysite.com.ua"
          autoComplete="off"
          spellCheck={false}
          aria-label="Бажаний домен"
          className="flex-1"
        />
        <Button variant="secondary" size="md" disabled={busy || !value.trim()} onClick={() => void check()}>
          {busy ? "Перевіряю…" : "Перевірити"}
        </Button>
      </div>

      {checked && (
        <div className="flex flex-wrap items-center gap-2 text-[14px] font-semibold text-ink-muted">
          <span className="font-bold text-ink">{checked.domain}</span>
          <Chip tone={AVAILABILITY[checked.available].tone}>{AVAILABILITY[checked.available].label}</Chip>
        </div>
      )}
      {error && <p className="text-[14px] font-semibold text-danger">{error}</p>}

      <div className="flex flex-col gap-2">
        {payRequired ? (
          /* Payment panel — inside the card, so the owner never loses the name
             they typed or the availability verdict they just got. */
          <div className="flex flex-col gap-2 rounded-[16px] bg-sunken p-4">
            {paid ? (
              /* Paid, but the request that followed failed. The domain is bought
                 — the only way forward is another attempt, never a second
                 checkout. */
              <>
                <Button
                  size="lg"
                  className="w-full"
                  disabled={busy || paywall.retrying}
                  onClick={() => void paywall.retry()}
                >
                  {busy || paywall.retrying ? "Надсилаємо…" : "Спробувати ще раз"}
                </Button>
                <span className="text-[14px] leading-snug text-ink-muted">
                  Оплату отримано — повторно платити не потрібно.
                </span>
              </>
            ) : awaiting ? (
              <div className="flex flex-col gap-1.5" role="status">
                <span className="flex items-center gap-2.5 text-[16px] font-bold text-ink">
                  <span
                    className="inline-block h-4 w-4 animate-spin rounded-full border-[2.5px] border-honey border-t-transparent"
                    aria-hidden
                  />
                  Очікуємо оплату…
                </span>
                <span className="text-[14px] leading-snug text-ink-muted">
                  Оплата відкрилась у новій вкладці. Поверніться сюди — щойно платіж пройде, ми
                  приймемо замовлення на домен.
                </span>
              </div>
            ) : (
              <Button
                size="lg"
                className="w-full"
                disabled={paywall.status === "creating" || busy}
                onClick={() => void paywall.start()}
              >
                {paywall.status === "creating"
                  ? "Готуємо оплату…"
                  : payFailed
                    ? "Спробувати ще раз"
                    : `Оплатити — ${price} грн`}
              </Button>
            )}

            {payFailed && paywall.error && (
              <p className="rounded-[14px] bg-danger-soft px-4 py-3 text-[14px] font-semibold leading-relaxed text-danger">
                {paywall.status === "failed" ? "Оплата не пройшла. " : ""}
                {paywall.error}
              </p>
            )}

            <p className="text-[13px] leading-relaxed text-ink-faint">
              Оплата через WayForPay. Умови — у{" "}
              {/* The offer lives on the marketing root — this screen runs on the
                  app host, where middleware rewrites /oferta into /app. */}
              <a
                href={rootSiteUrl("/oferta")}
                target="_blank"
                rel="noreferrer"
                className="underline underline-offset-2 hover:text-ink-muted"
              >
                публічній оферті
              </a>
              .
            </p>
          </div>
        ) : (
          <Button size="md" disabled={busy || !value.trim()} onClick={() => void order()}>
            {busy ? "Надсилаємо…" : `Замовити домен — ${price} грн`}
          </Button>
        )}

        <Button
          variant="quiet"
          size="md"
          disabled={awaiting}
          onClick={() => {
            phCapture("ui_domain_skipped", { host, checked: checked !== null });
            if (onSkip) onSkip();
            else setSkipped(true);
          }}
        >
          Продовжити без власного домену
        </Button>
      </div>
    </Card>
  );
}
