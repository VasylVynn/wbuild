"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CircleCheck, CircleX, Hourglass, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui";
import { pixelTrack } from "@/lib/analytics/pixel";
import { getOrderStatusAction } from "../actions";

/**
 * WayForPay `returnUrl` landing (spec 2026-08-05 §2). Purely observational: the
 * webhook decides whether an order is paid, this screen only waits for that
 * decision to show up and tells the owner what to do next.
 *
 * The wait is real — WayForPay redirects the browser back before (or racing
 * with) the server-to-server callback, so «оплата пройшла» must never be
 * inferred from the redirect alone.
 */

const POLL_MS = 3000;
const MAX_ATTEMPTS = 40; // ~2 minutes

type View = "missing" | "checking" | "paid" | "failed" | "timeout";

export function PayResult({
  orderReference,
  amount,
}: {
  orderReference?: string;
  amount: number;
}) {
  const [view, setView] = useState<View>(orderReference ? "checking" : "missing");
  const purchaseTracked = useRef(false);

  useEffect(() => {
    if (!orderReference) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let attempts = 0;

    const poll = async () => {
      attempts += 1;
      const res = await getOrderStatusAction(orderReference).catch(() => null);
      if (cancelled) return;

      if (res?.ok) {
        if (res.status === "paid") {
          if (!purchaseTracked.current) {
            purchaseTracked.current = true;
            // eventID = order_reference so a future Conversions API send dedupes.
            pixelTrack("Purchase", { value: amount, currency: "UAH" }, orderReference);
          }
          setView("paid");
          return;
        }
        if (res.status !== "pending") {
          setView("failed");
          return;
        }
      }

      // Still pending, or a transient lookup failure: the order row can also
      // lag a moment behind the redirect. Keep waiting.
      if (attempts >= MAX_ATTEMPTS) {
        setView("timeout");
        return;
      }
      timer = setTimeout(poll, POLL_MS);
    };

    void poll();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [orderReference, amount]);

  return (
    // Full-width canvas, content constrained INSIDE — max-w on the <main>
    // itself would clip the background to a centered stripe on desktop.
    <main className="flex min-h-screen flex-col items-center justify-center bg-canvas px-6 py-16">
      <div className="flex w-full max-w-md flex-col items-center gap-2 text-center">
      {view === "checking" && (
        <>
          <Badge tone="honey">
            <LoaderCircle size={32} className="animate-spin" />
          </Badge>
          <Title>Перевіряємо оплату…</Title>
          <Text>
            Це займає до хвилини. Не закривайте цю сторінку — щойно банк підтвердить платіж,
            ми покажемо це тут.
          </Text>
        </>
      )}

      {view === "paid" && (
        <>
          <Badge tone="ok">
            <CircleCheck size={32} />
          </Badge>
          <Title>Оплата пройшла!</Title>
          <Text>
            Поверніться у вкладку з редактором і натисніть <b className="text-ink">Опублікувати</b>{" "}
            ще раз — сайт одразу стане доступним.
          </Text>
          <Link href="/sites" className="mt-6">
            <Button className="rounded-full">Мої сайти</Button>
          </Link>
        </>
      )}

      {view === "failed" && (
        <>
          <Badge tone="danger">
            <CircleX size={32} />
          </Badge>
          <Title>Оплата не пройшла</Title>
          <Text>
            Гроші не списано. Найчастіше причина — банк відхилив платіж або на картці
            недостатньо коштів. Поверніться у вкладку з редактором і спробуйте ще раз.
          </Text>
          <Link href="/sites" className="mt-6">
            <Button variant="secondary" className="rounded-full">
              Мої сайти
            </Button>
          </Link>
        </>
      )}

      {view === "timeout" && (
        <>
          <Badge tone="honey">
            <Hourglass size={32} />
          </Badge>
          <Title>Платіж ще обробляється</Title>
          <Text>
            Банк думає довше, ніж зазвичай. Оновіть цю сторінку за кілька хвилин — якщо статус
            не зміниться, напишіть нам, і ми розберемось.
          </Text>
          <Link href="/sites" className="mt-6">
            <Button variant="secondary" className="rounded-full">
              Мої сайти
            </Button>
          </Link>
        </>
      )}

      {view === "missing" && (
        <>
          <Badge tone="danger">
            <CircleX size={32} />
          </Badge>
          <Title>Замовлення не знайдено</Title>
          <Text>Схоже, посилання неповне. Поверніться у вкладку з редактором і спробуйте ще раз.</Text>
          <Link href="/sites" className="mt-6">
            <Button variant="secondary" className="rounded-full">
              Мої сайти
            </Button>
          </Link>
        </>
      )}
      </div>
    </main>
  );
}

const badgeTones = {
  honey: "bg-honey-soft text-honey-text",
  ok: "bg-ok-soft text-ok",
  danger: "bg-danger-soft text-danger",
} as const;

function Badge({ tone, children }: { tone: keyof typeof badgeTones; children: React.ReactNode }) {
  return (
    <div
      className={`animate-pop flex h-[72px] w-[72px] items-center justify-center rounded-full ${badgeTones[tone]}`}
    >
      {children}
    </div>
  );
}

function Title({ children }: { children: React.ReactNode }) {
  return (
    <h1 className="animate-rise mt-6 font-brand text-[26px] font-semibold text-ink">{children}</h1>
  );
}

function Text({ children }: { children: React.ReactNode }) {
  return <p className="animate-rise text-[17px] leading-relaxed text-ink-muted">{children}</p>;
}
