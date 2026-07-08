import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Manrope, Unbounded } from "next/font/google";
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

export const metadata: Metadata = {
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
