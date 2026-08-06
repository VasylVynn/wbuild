"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createCheckoutAction, getOrderStatusAction } from "@/app/app/pay/actions";
import { pixelTrack } from "@/lib/analytics/pixel";
import { phCapture } from "@/components/analytics/PostHogProvider";

/**
 * The ₴999 paywall, client half: the ONE checkout + polling implementation.
 * Since 2026-08-06 it gates the CUSTOM DOMAIN, not publishing — the surface that
 * uses it today is the domain card on the onboarding success screen.
 *
 * Flow: open a payment tab → create the order → post the signed WayForPay form
 * into that tab → poll our own order row until the signed callback flips it.
 * Payment happens in a separate tab so the page behind it survives — which is
 * also why we poll instead of waiting for a return navigation.
 *
 * Nothing here can grant paid state: it only reads `orders.status`, which only
 * the verified WayForPay callback writes.
 *
 * It also owns the two client-side checkout events (`ui_checkout_click`,
 * `ui_payment_confirmed`) for every surface, so one owner paying once counts
 * once no matter where the panel lives; `surface` is what tells them apart.
 * Conversion counting still belongs to the server's `checkout_created` /
 * `payment_success` — these are the UI's view of the same moments, and they can
 * legitimately go missing (tab closed mid-poll).
 */

/** Offer price in UAH. Mirrors PRICE_UAH's default and the landing copy — the
 *  real amount is charged from the server-built form, this drives copy + pixel. */
export const PRICE_UAH = 999;

/** Named target so the tab opened on click is the one the form posts into. */
const PAY_WINDOW = "wfp_checkout";
const POLL_MS = 3000;
/** ~10 minutes: an abandoned hosted page should stop costing us requests. */
const POLL_LIMIT = 200;

export type PaywallStatus =
  | "idle" // offer shown, nothing started
  | "creating" // order being created
  | "awaiting" // payment tab open, polling
  | "paid" // callback confirmed — onPaid() has run
  | "failed" // declined / expired / gave up waiting
  | "error"; // we could not even start (config, rate limit, network)

type OrderStatusReply = Awaited<ReturnType<typeof getOrderStatusAction>>;

const FAILED_MESSAGE = "Оплата не пройшла. Спробуйте ще раз — гроші не списано.";
const TIMEOUT_MESSAGE =
  "Ми не дочекались підтвердження оплати. Якщо ви оплатили — напишіть нам, ми все активуємо.";

export function usePaywallCheckout({
  host,
  surface,
  onPaid,
}: {
  host: string;
  /** Which paywall the owner is looking at — the only thing separating the call
   *  sites in analytics. */
  surface: "domain" | "onboard" | "editor";
  /** Runs right after the order turns `paid` (re-submit the domain request).
   *  Re-runnable: `retry` calls it again when that follow-up failed. */
  onPaid: () => void | Promise<void>;
}) {
  const [status, setStatus] = useState<PaywallStatus>("idle");
  const [error, setError] = useState("");
  const [retrying, setRetrying] = useState(false);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stoppedRef = useRef(false);
  // onPaid is typically an inline closure — keep the latest without restarting
  // the poll loop.
  const onPaidRef = useRef(onPaid);
  onPaidRef.current = onPaid;
  // Same reason as onPaidRef: the poll loop is memoized with no deps, so its
  // event context is read through a ref rather than re-arming the loop.
  const eventCtxRef = useRef({ surface, host });
  eventCtxRef.current = { surface, host };

  const clearTimer = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
  };

  // Unmount (owner navigates away mid-payment) must not leave a timer running.
  useEffect(() => {
    return () => {
      stoppedRef.current = true;
      clearTimer();
    };
  }, []);

  const poll = useCallback((orderReference: string, attempt: number) => {
    clearTimer();
    timerRef.current = setTimeout(async () => {
      if (stoppedRef.current) return;

      // ONLY the order's own status may end this wait. Every way the read can
      // fail — our rate limit, a row the replica hasn't caught up with, a server
      // action that rejects outright mid-deploy — says nothing about whether the
      // owner paid, so all of them fall through to the next attempt. A rejection
      // left unhandled here would kill the loop and strand the panel on
      // «Очікуємо оплату…» forever, with the money already taken.
      let res: OrderStatusReply | null = null;
      try {
        res = await getOrderStatusAction(orderReference);
      } catch {
        res = null;
      }
      if (stoppedRef.current) return;

      if (res?.ok) {
        if (res.status === "paid") {
          setStatus("paid");
          // Before onPaid: the owner has paid whether or not the step that
          // follows it succeeds, and this loop reaches `paid` exactly once.
          phCapture("ui_payment_confirmed", eventCtxRef.current);
          // A follow-up that throws must not take the poll loop's callback down
          // with it: the order is paid, and `paid` is the state that offers the
          // owner a retry instead of a second checkout.
          try {
            await onPaidRef.current();
          } catch {
            /* the paid panel's retry is the recovery path */
          }
          return;
        }
        if (res.status !== "pending") {
          // declined / expired / refunded — all mean «not published today».
          setError(FAILED_MESSAGE);
          setStatus("failed");
          return;
        }
      }
      // Deadline reached — the only negative ending a failed read can produce.
      if (attempt + 1 >= POLL_LIMIT) {
        setError(TIMEOUT_MESSAGE);
        setStatus("failed");
        return;
      }
      poll(orderReference, attempt + 1);
    }, POLL_MS);
  }, []);

  /** Call straight from the click handler — it opens the tab synchronously. */
  const start = useCallback(async () => {
    // `paid` is a hard stop, not just a busy state: this site is already bought.
    // If the step that follows payment failed, the way out is retry() — opening
    // a second checkout would charge the owner twice for one site.
    if (status === "paid" || status === "creating" || status === "awaiting") return;
    stoppedRef.current = false;
    setError("");
    setStatus("creating");

    // Past the guard above, so a second tap on a busy paywall stays uncounted.
    pixelTrack("InitiateCheckout", { value: PRICE_UAH, currency: "UAH" });
    phCapture("ui_checkout_click", { surface, host });

    // Opened BEFORE the await: after an async hop the click no longer counts as
    // a user gesture and the popup blocker eats the tab.
    const payWindow = typeof window !== "undefined" ? window.open("", PAY_WINDOW) : null;

    const res = await createCheckoutAction(host);
    if (!res.ok) {
      payWindow?.close();
      setError(res.error);
      setStatus("error");
      return;
    }

    const form = document.createElement("form");
    form.method = "POST";
    form.action = res.checkout.action;
    form.target = payWindow ? PAY_WINDOW : "_blank";
    form.style.display = "none";
    for (const [name, value] of Object.entries(res.checkout.fields)) {
      const input = document.createElement("input");
      input.type = "hidden";
      input.name = name;
      input.value = value;
      form.appendChild(input);
    }
    document.body.appendChild(form);
    form.submit();
    form.remove();

    setStatus("awaiting");
    poll(res.orderReference, 0);
  }, [host, surface, status, poll]);

  /**
   * Run onPaid again after a paid order whose follow-up failed (a DB blip, a
   * rate limit). The payment stands — only that step is retried, so this never
   * touches the checkout.
   */
  const retry = useCallback(async () => {
    if (retrying) return;
    setRetrying(true);
    try {
      await onPaidRef.current();
    } finally {
      setRetrying(false);
    }
  }, [retrying]);

  /** Back to the offer — used by «Спробувати ще раз» after a decline. A `paid`
   *  order is never reset: dropping back to `idle` would re-arm start() and let
   *  a second checkout open for a site that is already bought. */
  const reset = useCallback(() => {
    if (status === "paid") return;
    stoppedRef.current = true;
    clearTimer();
    setError("");
    setStatus("idle");
  }, [status]);

  return { status, error, start, reset, retry, retrying };
}
