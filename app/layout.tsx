import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Manrope, Unbounded } from "next/font/google";
import { isApifyConfigured } from "@/lib/ig/apify";
import "./globals.css";

const manrope = Manrope({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-manrope",
});

const unbounded = Unbounded({
  subsets: ["latin", "cyrillic"],
  weight: ["500", "600"],
  variable: "--font-unbounded",
});

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
    <html lang="uk" className={`${manrope.variable} ${unbounded.variable}`}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
