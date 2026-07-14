"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import type { BlockProps } from "@/lib/blocks/schema";

/*
 * Lead form — NO source equivalent. The FORM behaviour is copied verbatim from
 * components/blocks/LeadForm.tsx: it POSTs { name, phone, message, website } to
 * /api/leads on the same tenant host, carries the "website" honeypot, and walks
 * the idle → sending → sent/error states. Only the styling is re-skinned to the
 * template: a bordered dark card, `.section-title` heading, dark bordered
 * inputs (the source's contact-stub input look) and a `.btn-gradient` submit.
 */
export default function LeadFormSection({ data }: { data: unknown }) {
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
    "w-full rounded-md bg-white/[0.03] border border-[var(--color-border)] px-4 py-3 text-sm text-white placeholder-zinc-500 transition-colors focus:outline-none focus:border-[var(--color-accent)]";

  return (
    <section className="py-12 md:py-16" aria-labelledby="lead-form-title">
      <div className="container mx-auto px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6 }}
          className="card max-w-xl mx-auto"
        >
          <h2 id="lead-form-title" className="section-title mb-2" style={{ marginBottom: "0.5rem" }}>
            {d.title ?? "Залишити заявку"}
          </h2>
          {d.subtitle && <p className="text-zinc-400 text-sm mb-6">{d.subtitle}</p>}

          {state === "sent" ? (
            <p className="mt-6 text-lg font-medium text-[var(--color-accent)]">
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
                className="btn-gradient mt-2 w-full disabled:opacity-50"
              >
                {state === "sending" ? "Надсилаємо…" : (d.buttonLabel ?? "Надіслати заявку")}
              </button>
              {state === "error" && (
                <p className="text-sm text-zinc-400">
                  Не вдалося надіслати. Спробуйте ще раз або зателефонуйте нам.
                </p>
              )}
            </form>
          )}
        </motion.div>
      </div>
    </section>
  );
}
