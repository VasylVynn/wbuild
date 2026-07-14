"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import type { BlockProps } from "@/lib/blocks/schema";
import { ScrollReveal } from "./ScrollReveal";

/*
 * Lead form — NO source equivalent. The FORM behaviour is copied verbatim
 * from studio's LeadFormSection (itself lifted from components/blocks/
 * LeadForm.tsx): POST { name, phone, message, website } to /api/leads on the
 * same tenant host, honeypot field, idle → sending → sent/error states.
 * Only the styling is re-skinned to salon: a glass-card pill-rounded panel,
 * serif gold-gradient title, rounded-2xl inputs, and a full-width
 * btn-gold-luxe submit.
 */
export default function SalonLeadForm({ data }: { data: unknown }) {
  const d = data as BlockProps["lead_form"];
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState(""); // honeypot — humans never see it

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (state === "sending") return;
    if (!phone.trim() && !name.trim()) return;
    setState("sending");
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone, message, website }),
      });
      setState(res.ok ? "sent" : "error");
    } catch {
      setState("error");
    }
  };

  const inputClass =
    "w-full rounded-2xl bg-background/60 border border-border px-4 py-3 text-sm text-foreground placeholder-muted-foreground transition-colors focus:outline-none focus:border-accent";

  return (
    <section className="py-16 sm:py-20 lg:py-24 relative" aria-labelledby="lead-form-title">
      <div className="section-container relative z-10">
        <ScrollReveal>
          <motion.div
            whileHover={{ scale: 1.01 }}
            className="glass-card rounded-3xl p-8 max-w-xl mx-auto"
          >
            <h2 id="lead-form-title" className="font-display text-3xl md:text-4xl font-semibold text-gradient-gold mb-2">
              {d.title ?? "Залишити заявку"}
            </h2>
            {d.subtitle && <p className="text-muted-foreground text-sm mb-6">{d.subtitle}</p>}

            {state === "sent" ? (
              <p className="mt-6 text-lg font-medium text-accent">
                ✅ Дякуємо! Ми звʼяжемось з вами найближчим часом.
              </p>
            ) : (
              <form onSubmit={submit} className="mt-6 flex flex-col gap-3">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ваше імʼя"
                  className={inputClass}
                />
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Телефон"
                  required
                  className={inputClass}
                />
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Що вас цікавить? (необовʼязково)"
                  rows={3}
                  className={`${inputClass} resize-none`}
                />
                {/* Honeypot: hidden from humans, tempting for bots */}
                <input
                  type="text"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  tabIndex={-1}
                  autoComplete="off"
                  aria-hidden="true"
                  style={{ position: "absolute", left: "-9999px", height: 0, width: 0, opacity: 0 }}
                />
                <button
                  type="submit"
                  disabled={state === "sending"}
                  className="btn-gold-luxe rounded-full mt-2 w-full py-3 text-sm font-medium disabled:opacity-50"
                >
                  {state === "sending" ? "Надсилаємо…" : (d.buttonLabel ?? "Надіслати заявку")}
                </button>
                {state === "error" && (
                  <p className="text-sm text-muted-foreground">
                    Не вдалося надіслати. Спробуйте ще раз або зателефонуйте нам.
                  </p>
                )}
              </form>
            )}
          </motion.div>
        </ScrollReveal>
      </div>
    </section>
  );
}
