// scripts/check-db.mjs — verify env keys + Supabase connectivity/migration.
// Prints presence + format only, NEVER the secret values. Run: node scripts/check-db.mjs
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = {};
try {
  const raw = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  for (const line of raw.split("\n")) {
    if (line.trim().startsWith("#")) continue;
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2].trim();
  }
} catch (e) {
  console.error("Cannot read .env.local:", e.message);
  process.exit(1);
}

const report = (name, prefixes) => {
  const v = env[name] || "";
  const ok = v.length > 0 && prefixes.some((p) => v.startsWith(p));
  console.log(
    `${name.padEnd(40)} ${v ? "SET" : "EMPTY"}  len=${String(v.length).padStart(3)}  format=${v ? (ok ? "ok" : "??") : "-"}`,
  );
};

console.log("=== key presence (values never printed) ===");
report("NEXT_PUBLIC_SUPABASE_URL", ["https://"]);
report("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", ["sb_publishable_", "eyJ"]);
report("SUPABASE_SERVICE_ROLE_KEY", ["sb_secret_", "eyJ"]);
report("ANTHROPIC_API_KEY", ["sk-ant-"]);

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const secret = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !secret) {
  console.log("\nSupabase not fully configured; skipping DB check.");
  process.exit(0);
}

console.log("\n=== Supabase connectivity + migration check ===");
const sb = createClient(url, secret, { auth: { persistSession: false } });
for (const table of ["tenants", "pages", "conversations", "tenant_members"]) {
  // Real select (not head) so a missing table surfaces the PGRST205 error
  // instead of silently returning a null count.
  const { data, error } = await sb.from(table).select("*").limit(1);
  if (error) console.log(`${table.padEnd(16)} MISSING/ERROR  ${error.code ?? ""}  ${error.message}`);
  else console.log(`${table.padEnd(16)} OK (exists, sample rows=${data.length})`);
}
