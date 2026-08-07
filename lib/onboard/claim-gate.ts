/**
 * M1 claim gate — PURE decision logic (landing-chat plan §7-M1, wave W2).
 *
 * The `?conv=` handoff link is a UUID bearer token: whoever holds it can load
 * the conversation and try to generate into its draft tenant. Without a gate
 * the second holder silently became a co-owner (tenant_members has a composite
 * PK (tenant_id, user_id) — nothing stops a SECOND user id from inserting).
 *
 * Races are arbitrated by the DATABASE, not app logic (security review): the
 * partial unique index `tenant_members_one_owner` (migration 0012) makes the
 * second `role = 'owner'` insert fail with 23505 — first COMMITTED claim wins,
 * atomically. The wiring lives in lib/onboard/generate-flow.ts so BOTH
 * transports (SSE route + fallback action) pass through one policy.
 *
 * Client-safe and dependency-free so vitest covers it directly and the chat UI
 * may import the refusal copy for its own honest states.
 */

/** Honest refusal copy (Ukrainian — product language). */
export const CLAIMED_BY_OTHER_ERROR =
  "Цей сайт уже привʼязаний до іншого акаунта. Почніть нову розмову — і я зберу окремий сайт для вас.";

/** Transient refusal: the gate could not VERIFY ownership — it must fail
 *  closed (no membership grant, no model spend) rather than guess. */
export const CLAIM_CHECK_FAILED_ERROR =
  "Не вдалося перевірити, чий це сайт. Спробуйте ще раз за хвилину.";

/** True when the tenant already has a member other than the current user —
 *  the site belongs to someone else and this claim must be refused. */
export function hasForeignMember(memberIds: readonly string[], userId: string): boolean {
  return memberIds.some((id) => id !== userId);
}
