"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import type { BlockProps } from "@/lib/blocks/schema";
import { ScrollReveal } from "./ScrollReveal";
import SalonOrganicShapes from "./SalonOrganicShapes";

/*
 * Lead form — `split` variant. Identical form CONTRACT to SalonLeadForm: POSTs
 * { name, phone, message, website } to /api/leads on the tenant host, carries
 * the "website" honeypot, walks idle → sending → sent/error. Only the SHELL
 * changes: a single centred card becomes an asymmetric split where a decor panel
 * (organic floating shapes + the heading, no image — §4.8) sits beside the form
 * glass-card. Column axis, the decor panel and alignment all differ from the base.
 */
export default function SalonLeadFormSplit({ data }: { data: unknown }) {
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
    <section className="relative py-16 sm:py-20 lg:py-24" aria-labelledby="lead-form-title">
      <div className="section-container relative z-10">
        <div className="asym-grid mx-auto max-w-5xl items-stretch">
          {/* Decor panel */}
          <ScrollReveal direction="left" className="asym-left">
            <div className="glass-card shape-blob relative flex h-full min-h-[220px] flex-col justify-center overflow-hidden p-10">
              <SalonOrganicShapes />
              <div className="relative z-10">
                <h2 id="lead-form-title" className="font-display text-gradient-gold text-3xl font-semibold md:text-4xl">
                  {d.title ?? "Залишити заявку"}
                </h2>
                {d.subtitle && <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{d.subtitle}</p>}
              </div>
            </div>
          </ScrollReveal>

          {/* Form */}
          <ScrollReveal direction="right" className="asym-right w-full">
            <motion.div whileHover={{ scale: 1.01 }} className="glass-card rounded-3xl p-8">
              {state === "sent" ? (
                <p className="text-lg font-medium text-accent">✅ Дякуємо! Ми звʼяжемось з вами найближчим часом.</p>
              ) : (
                <form onSubmit={submit} className="flex flex-col gap-3">
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
                    className="btn-gold-luxe mt-2 w-full rounded-full py-3 text-sm font-medium disabled:opacity-50"
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
      </div>
    </section>
  );
}
