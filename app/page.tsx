import { ROOT_DOMAIN } from "@/lib/config";
import { SiteHeader } from "@/components/landing/SiteHeader";
import { Hero } from "@/components/landing/Hero";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { Examples } from "@/components/landing/Examples";
import { TelegramSection } from "@/components/landing/TelegramSection";
import { Features } from "@/components/landing/Features";
import { Faq } from "@/components/landing/Faq";
import { SiteFooter } from "@/components/landing/SiteFooter";
import { MetaPixel } from "@/lib/analytics/pixel";
import { PostHogProvider } from "@/components/analytics/PostHogProvider";

/**
 * 3minsite marketing landing — served on the root/www platform hosts (§2.5).
 * Sells the FUNNEL, not the site: «Клієнти з інтернету — прямо у ваш Telegram».
 *
 * Sections live in components/landing/**; this page only resolves the two real
 * destinations and hands them down, so nothing below imports lib/config across
 * a client boundary. Light theme only, Ukrainian copy, phone-first.
 */

// CTA targets live on the dashboard host (app.<root>). ROOT_DOMAIN carries the
// dev port (lvh.me:3000) and drops it in prod — mirror app/new/actions.ts.
const isProd = process.env.NODE_ENV === "production";
const APP_HOST = `${isProd ? "https" : "http"}://app.${ROOT_DOMAIN}`;
const NEW_URL = `${APP_HOST}/new`;
const LOGIN_URL = `${APP_HOST}/login`;

export default function PlatformHome() {
  return (
    <main className="min-h-screen bg-canvas text-ink">
      {/* Ad traffic lands here — PageView is the top of the measured funnel (§5). */}
      <MetaPixel />
      <PostHogProvider />
      <SiteHeader newUrl={NEW_URL} loginUrl={LOGIN_URL} />
      <Hero newUrl={NEW_URL} />
      <HowItWorks />
      <Examples />
      <TelegramSection />
      <Features />
      <Faq />
      <SiteFooter newUrl={NEW_URL} loginUrl={LOGIN_URL} />
    </main>
  );
}
