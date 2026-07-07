// scripts/try-write.mjs — probe whether the direct service client can WRITE.
// Inserts a throwaway tenant row and deletes it. Prints result only.
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = {};
for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
  if (line.trim().startsWith("#")) continue;
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].trim();
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const { data, error } = await sb
  .from("tenants")
  .insert({ host: "__probe__", canonical_hostname: "__probe__", draft_theme: {} })
  .select()
  .single();

if (error) {
  console.log("INSERT FAILED:", error.message, "| code:", error.code ?? "-");
} else {
  console.log("INSERT OK id=", data.id);
  const { error: delErr } = await sb.from("tenants").delete().eq("id", data.id);
  console.log(delErr ? `cleanup failed: ${delErr.message}` : "cleaned up");
}
