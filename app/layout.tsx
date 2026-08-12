import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { isApifyConfigured } from "@/lib/ig/apify";
import "./globals.css";
// Self-hosted fonts (scripts/vendor-fonts.mjs): every @font-face the product
// uses plus the :root --font-* variables the design system reads. Replaces the
// next/font/google loaders that broke the build whenever Google rotated files.
import "./fonts.css";

export const viewport: Viewport = {
  colorScheme: "light",
  themeColor: "#f7f0e0",
};

// The IG promise is env-gated like the hero: without APIFY the chat cannot
// import from Instagram, so the <title>/description must not advertise it
// (copy review 2026-08-12). Evaluated at build/request time server-side;
// tenant pages override this via their own generateMetadata.
export const metadata: Metadata = isApifyConfigured()
  ? {
      title: "3minsite — сайт з Instagram, щоб вас знаходили в Google",
      description:
        "Надішліть посилання на Instagram — помічник збере сайт із ваших фото, послуг і контактів. Заявки клієнтів — у вашому Telegram.",
    }
  : {
      title: "3minsite — клієнти з інтернету, прямо у ваш Telegram",
      description: "Сайт для вашого бізнесу за розмову з помічником — і заявки клієнтів у Telegram.",
    };

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="uk">
      <body className="antialiased">{children}</body>
    </html>
  );
}
