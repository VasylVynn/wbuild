import "server-only";
import { getServiceClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { ROOT_DOMAIN, stripPort } from "@/lib/config";
import { isReservedSubdomain } from "@/lib/tenant/reserved";

/**
 * Subdomain generation from a Ukrainian business name (brief §4.4): transliterate
 * → slug → check collisions in the DB, suffixing until free. Returns a full host
 * like `kvity-oksany.lvh.me` (dev) / `...vitryna.com.ua` (prod).
 */
const UK_MAP: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "h", ґ: "g", д: "d", е: "e", є: "ie", ж: "zh", з: "z",
  и: "y", і: "i", ї: "i", й: "i", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p",
  р: "r", с: "s", т: "t", у: "u", ф: "f", х: "kh", ц: "ts", ч: "ch", ш: "sh",
  щ: "shch", ь: "", ю: "iu", я: "ia", "'": "", "’": "", "ʼ": "",
};

export function transliterate(input: string): string {
  return input
    .toLowerCase()
    .split("")
    .map((ch) => (ch in UK_MAP ? UK_MAP[ch] : ch))
    .join("");
}

export function toSlug(input: string): string {
  const slug = transliterate(input)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
  return slug || "site";
}

/** A host that is not reserved and not already taken by another tenant. */
export async function uniqueSubdomain(businessName: string): Promise<string> {
  // A production deploy without NEXT_PUBLIC_ROOT_DOMAIN would silently mint
  // tenants on the lvh.me dev fallback — permanent broken hosts in the prod DB
  // (observed live). Fail loudly instead: this is a deploy misconfiguration.
  if (process.env.NODE_ENV === "production" && !process.env.NEXT_PUBLIC_ROOT_DOMAIN) {
    throw new Error(
      "NEXT_PUBLIC_ROOT_DOMAIN is not set in production — refusing to mint a *.lvh.me tenant host",
    );
  }
  const root = stripPort(ROOT_DOMAIN);
  let base = toSlug(businessName);
  if (isReservedSubdomain(base)) base = `${base}-kvity`;

  if (!isSupabaseConfigured()) return `${base}.${root}`;

  const sb = getServiceClient();
  const candidates = [base, ...Array.from({ length: 60 }, (_, i) => `${base}-${i + 2}`)];
  for (const label of candidates) {
    const host = `${label}.${root}`;
    const { data } = await sb.from("tenants").select("id").eq("host", host).maybeSingle();
    if (!data) return host;
  }
  return `${base}-${candidates.length}.${root}`;
}
