import { ROOT_DOMAIN } from "@/lib/config";
import { isApifyConfigured } from "@/lib/ig/apify";
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
 * The hero IS the onboarding chat (landing-chat-first plan §3.1, W1): a text h1
 * for SEO, then the embedded OnboardChat island; the proof sections stay below
 * it. M11 (logged-in visitors see «ваш сайт» instead of the chat) is degraded
 * by design here — auth cookies live on the app host only — see HeroChat.tsx.
 *
 * The remaining sections live in components/landing/**; this page resolves the
 * real cross-host destinations and hands them down, so nothing below imports
 * lib/config across a client boundary. Light theme only, Ukrainian copy,
 * phone-first.
 */

// Server actions invoked from this page inherit its budget (M4). The embedded
// hero chat drives the same onboarding actions as app./new — photo analysis,
// IG import and generation are real model calls; 180s wasn't always enough
// (live 504 FUNCTION_INVOCATION_TIMEOUT on 2026-08-06). 300 to match
// app/app/new/page.tsx, the editor and admin generate pages.
export const maxDuration = 300;

// Cross-host targets live on the dashboard host (app.<root>). ROOT_DOMAIN
// carries the dev port (lvh.me:3000) and drops it in prod — mirror
// app/new/actions.ts. app./new stays alive (plan §3.1) — the footer still
// links to it; the header CTA now scrolls to the hero chat instead.
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
      <SiteHeader loginUrl={LOGIN_URL} />
      <Hero igImportEnabled={isApifyConfigured()} />
      <HowItWorks />
      <Examples />
      <TelegramSection />
      <Features />
      <Faq />
      <SiteFooter newUrl={NEW_URL} loginUrl={LOGIN_URL} />
    </main>
  );
}
