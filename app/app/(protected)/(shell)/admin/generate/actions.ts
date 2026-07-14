"use server";

import { revalidatePath } from "next/cache";
import { isPlatformAdmin } from "@/lib/admin";
import { getServiceClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/supabase/auth";
import { generateAndPublish } from "@/lib/site/publish";
import { ROOT_DOMAIN, stripPort } from "@/lib/config";
import { revalidateTenant } from "@/lib/cache";
import type { BusinessFacts } from "@/lib/verticals/schema";

/**
 * Founders-only one-click site generation for iterating on generation quality
 * (composition, copy, skins, hero images) without going through onboarding
 * chat. Same generateAndPublish() the real onboarding flow uses — this is a
 * shortcut to the input, not a different code path.
 */

const FIXTURES: Record<string, BusinessFacts> = {
  florist: {
    businessName: "Квіти від Олени",
    city: "Львів",
    phone: "+380671234567",
    address: "вул. Личаківська, 24",
    hours: "Пн–Нд 9:00–20:00",
    about: "Авторська флористика та швидка доставка квітів по місту вже 8 років.",
    services: [
      { name: "Авторський букет", price: "від 850 грн" },
      { name: "Доставка квітів по місту", price: "150 грн" },
      { name: "Весільна флористика", price: "від 5000 грн" },
      { name: "Оформлення свята", price: "від 3000 грн" },
    ],
  },
  bakery: {
    businessName: "Пекарня Колос",
    city: "Київ",
    phone: "+380509876543",
    address: "вул. Хрещатик, 15",
    hours: "Щодня 7:00–21:00",
    about: "Домашня випічка на заквасці, торти на замовлення та свіжа кава щоранку.",
    services: [
      { name: "Житній хліб", price: "45 грн" },
      { name: "Торт на замовлення", price: "від 900 грн" },
      { name: "Круасан", price: "55 грн" },
      { name: "Кава з собою", price: "60 грн" },
    ],
  },
  lawyer: {
    businessName: "Адвокат Ткаченко",
    city: "Харків",
    phone: "+380631112233",
    address: "просп. Науки, 42, офіс 5",
    hours: "Пн–Пт 9:00–18:00",
    about: "Практика з 2011 року: сімейне, договірне право та супровід угод.",
    services: [
      { name: "Консультація", price: "800 грн" },
      { name: "Складання договору", price: "від 1500 грн" },
      { name: "Супровід угоди", price: "від 5000 грн" },
      { name: "Представництво в суді", price: "від 10000 грн" },
    ],
  },
  autoservice: {
    businessName: "СТО Мотор",
    city: "Одеса",
    phone: "+380487654321",
    address: "вул. Дальницька, 8",
    hours: "Пн–Сб 8:00–19:00",
    about: "Діагностика та ремонт авто будь-якої марки, чесні ціни, гарантія на роботи.",
    services: [
      { name: "Комп'ютерна діагностика", price: "400 грн" },
      { name: "Заміна масла", price: "350 грн" },
      { name: "Шиномонтаж", price: "від 500 грн" },
      { name: "Ремонт ходової", price: "від 1200 грн" },
    ],
  },
  generic: {
    businessName: "Хімчистка Свіжо",
    city: "Дніпро",
    phone: "+380563334455",
    address: "вул. Гагаріна, 12",
    hours: "Пн–Сб 9:00–19:00",
    about: "Професійне чищення одягу, килимів та м'яких меблів з доставкою.",
    services: [
      { name: "Чистка одягу", price: "від 150 грн" },
      { name: "Чистка килимів", price: "від 300 грн" },
      { name: "Чистка м'яких меблів", price: "від 800 грн" },
    ],
  },
};

function randomSuffix(len = 4): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

// Exact shape of hosts adminTestGenerate creates. List/delete below match
// against this, so no other host — including a client's custom domain that
// happens to start with "test-" — can ever show up here or be deleted.
const TEST_HOST_RE = new RegExp(
  `^test-(?:${Object.keys(FIXTURES).join("|")})-[a-z0-9]{4}\\.${stripPort(ROOT_DOMAIN).replaceAll(".", "\\.")}$`,
);

export type AdminGenerateResult =
  | { ok: true; url: string; editHost: string; ms: number }
  | { ok: false; error: string };

export async function adminTestGenerate(verticalId: string): Promise<AdminGenerateResult> {
  if (!(await isPlatformAdmin())) return { ok: false, error: "Немає доступу." };

  const fixture = FIXTURES[verticalId];
  if (!fixture) return { ok: false, error: "Невідомий напрям." };

  const host = `test-${verticalId}-${randomSuffix()}.${stripPort(ROOT_DOMAIN)}`;
  const started = Date.now();

  try {
    await generateAndPublish(fixture, host, verticalId, true);
    const ms = Date.now() - started;

    // Owner membership so /edit/{host} works for whoever clicked generate —
    // skipped silently when no user (auth off), same as finalizeAction.
    const user = await getUser();
    if (user) {
      const sb = getServiceClient();
      const { data: t } = await sb.from("tenants").select("id").eq("host", host).maybeSingle();
      if (t) {
        await sb.from("tenant_members").insert({ tenant_id: t.id, user_id: user.id, role: "owner" });
      }
    }

    const isProd = process.env.NODE_ENV === "production";
    const port = ROOT_DOMAIN.includes(":") ? `:${ROOT_DOMAIN.split(":")[1]}` : "";
    const url = `${isProd ? "https" : "http"}://${host}${isProd ? "" : port}`;

    return { ok: true, url, editHost: host, ms };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export interface TestSite {
  id: string;
  host: string;
  vertical: string;
  created_at: string;
}

export async function adminListTestSites(): Promise<TestSite[]> {
  if (!(await isPlatformAdmin())) return [];

  const sb = getServiceClient();
  const { data } = await sb
    .from("tenants")
    .select("id, host, vertical, created_at")
    .like("host", "test-%")
    .order("created_at", { ascending: false });

  return ((data ?? []) as TestSite[]).filter((s) => TEST_HOST_RE.test(s.host));
}

export type AdminDeleteResult = { ok: true } | { ok: false; error: string };

/**
 * Refuses anything whose host doesn't match TEST_HOST_RE — this action must
 * never be able to delete a real client site, even given a wrong tenantId.
 */
export async function adminDeleteTestSite(tenantId: string): Promise<AdminDeleteResult> {
  if (!(await isPlatformAdmin())) return { ok: false, error: "Немає доступу." };

  const sb = getServiceClient();
  const { data: tenant } = await sb
    .from("tenants")
    .select("id, host")
    .eq("id", tenantId)
    .maybeSingle();
  if (!tenant) return { ok: false, error: "Сайт не знайдено." };
  if (!tenant.host || !TEST_HOST_RE.test(tenant.host)) {
    return { ok: false, error: "Можна видаляти тільки тест-сайти." };
  }

  await sb.from("pages").delete().eq("tenant_id", tenantId);
  await sb.from("tenant_members").delete().eq("tenant_id", tenantId);
  const { error } = await sb.from("tenants").delete().eq("id", tenantId);
  if (error) return { ok: false, error: error.message };

  await revalidateTenant(tenant.host);
  revalidatePath("/app/admin/generate");

  return { ok: true };
}
