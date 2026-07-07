import type { BusinessFacts } from "@/lib/verticals/schema";
import type { VerticalConfig } from "@/lib/verticals/types";

/**
 * Deterministic fact validation (owner feedback + Fable verdict): grounding
 * (§4.4) protects against MODEL fabrication, not USER garbage ("Саііуууу",
 * "+380988888888івйцф2", a service priced at 1 грн). Validators run in CODE and
 * emit issues; the agent turns issues into ONE gentle confirming question per
 * turn (no extra model calls). This does NOT trust the model to validate.
 */
export interface FactIssue {
  field: string;
  kind: "confirm" | "implausible";
  note: string; // instruction to the agent, not shown verbatim to the user
}

// Major Ukrainian cities (lowercased). Unknown → confirm, not reject (a real
// small town is confirmed with one question; garbage gets corrected).
const UA_CITIES = new Set([
  "київ", "харків", "одеса", "дніпро", "донецьк", "запоріжжя", "львів", "кривий ріг",
  "миколаїв", "маріуполь", "луганськ", "вінниця", "макіївка", "сімферополь", "херсон",
  "полтава", "чернігів", "черкаси", "хмельницький", "житомир", "суми", "рівне",
  "івано-франківськ", "кам'янське", "тернопіль", "луцьк", "біла церква", "краматорськ",
  "мелітополь", "керч", "нікополь", "ужгород", "бердянськ", "слав'янськ", "євпаторія",
  "кропивницький", "кременчук", "чернівці", "павлоград", "лисичанськ", "сєвєродонецьк",
  "олександрія", "конотоп", "умань", "мукачево", "дрогобич", "стрий", "коломия",
]);

function normalizePhoneUA(raw: string): string | null {
  const d = raw.replace(/\D/g, "");
  if (d.length === 12 && d.startsWith("380")) return `+${d}`;
  if (d.length === 11 && d.startsWith("80")) return `+3${d}`;
  if (d.length === 10 && d.startsWith("0")) return `+38${d}`;
  if (d.length === 9) return `+380${d}`;
  return null;
}

export function validatePhone(raw?: string): FactIssue | null {
  if (!raw || !raw.trim()) return null;
  const hasLetters = /[a-zа-яїієґ]/i.test(raw);
  const norm = normalizePhoneUA(raw);
  if (hasLetters || !norm) {
    return {
      field: "phone",
      kind: "confirm",
      note: `Телефон "${raw}" виглядає незвично — перепитати й підтвердити правильний український номер (формат +380XXXXXXXXX).`,
    };
  }
  return null;
}

export function validateCity(raw?: string): FactIssue | null {
  if (!raw || !raw.trim()) return null;
  const c = raw.trim().toLowerCase().replace(/^м\.?\s*/, "");
  if (UA_CITIES.has(c)) return null;
  for (const known of UA_CITIES) {
    if (known.startsWith(c) || c.startsWith(known)) return null;
  }
  return {
    field: "city",
    kind: "confirm",
    note: `Місто "${raw}" не впізнано — перепитати, чи правильно вказано назву міста.`,
  };
}

function parsePrice(s: string): number | null {
  const cleaned = s.replace(/\s| /g, "");
  const m = cleaned.match(/(\d[\d.,]*)/);
  if (!m) return null;
  const n = parseFloat(m[1].replace(/,/g, "."));
  return Number.isFinite(n) ? n : null;
}

export function validateServicePrice(
  name: string,
  priceText: string | undefined,
  range: { min: number; max: number },
): FactIssue | null {
  if (!priceText || !priceText.trim()) return null;
  const num = parsePrice(priceText);
  if (num == null) return null; // e.g. "договірна" — allow
  if (num < range.min) {
    return {
      field: "services",
      kind: "implausible",
      note: `Ціна послуги "${name}" — "${priceText}" — виглядає надто низькою для цієї сфери. Уточнити, чи правильно.`,
    };
  }
  if (num > range.max) {
    return {
      field: "services",
      kind: "implausible",
      note: `Ціна послуги "${name}" — "${priceText}" — виглядає надто високою. Уточнити, чи правильно.`,
    };
  }
  return null;
}

/** Run all validators against the current facts for a vertical. */
export function validateFacts(facts: Partial<BusinessFacts>, vertical: VerticalConfig): FactIssue[] {
  const issues: FactIssue[] = [];
  const phone = validatePhone(facts.phone);
  if (phone) issues.push(phone);
  const city = validateCity(facts.city);
  if (city) issues.push(city);
  for (const s of facts.services ?? []) {
    const priceIssue = validateServicePrice(s.name, s.price, vertical.priceRange);
    if (priceIssue) issues.push(priceIssue);
  }
  return issues;
}
