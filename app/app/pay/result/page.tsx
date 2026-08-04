import type { Metadata } from "next";
import { MetaPixel } from "@/lib/analytics/pixel";
import { priceUah } from "@/lib/payments/wayforpay";
import { PayResult } from "./PayResult.client";

/**
 * WayForPay returnUrl target. Outside the (protected) group on purpose: the
 * owner comes back from an external payment page and may have lost the session
 * cookie on the way — bouncing them to /login here would look like the payment
 * vanished.
 */

export const metadata: Metadata = {
  title: "Оплата — 3minsite",
  robots: { index: false, follow: false },
};

export default async function PayResultPage({
  searchParams,
}: {
  searchParams: Promise<{ orderReference?: string }>;
}) {
  const { orderReference } = await searchParams;
  // Price comes from the server: getOrderStatusAction deliberately returns
  // nothing but the status, and PRICE_UAH is not a NEXT_PUBLIC_ var.
  return (
    <>
      <MetaPixel />
      <PayResult orderReference={orderReference} amount={priceUah()} />
    </>
  );
}
