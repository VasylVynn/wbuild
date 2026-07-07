import { unstable_cache, revalidateTag } from "next/cache";
import { getPublishedPage } from "@/lib/tenant/data";

/**
 * Per-tenant caching + invalidation (brief §9.1).
 *
 * Cache key = the rewritten destination shape (host + slug), so different pages
 * of one tenant cache separately. Tags are per-tenant and per-page so "Publish"
 * can purge exactly one tenant WITHOUT touching the other thousands — never use
 * a path pattern with the dynamic [host] segment (it would nuke every tenant).
 *
 * This pattern targets STABLE Next 15.x: unstable_cache + single-arg
 * revalidateTag. Do not port to canary Cache Components APIs without re-reading
 * the docs for the pinned Next version.
 */

export const tenantTag = (host: string) => `tenant:${host}`;
export const pageTag = (host: string, slug: string) => `page:${host}:${slug}`;

export function getCachedPublishedPage(host: string, slug: string) {
  return unstable_cache(() => getPublishedPage(host, slug), ["published-page", host, slug], {
    tags: [tenantTag(host), pageTag(host, slug)],
  })();
}

/** Called on "Publish" (§5.5) — purge one tenant only. Saving a draft must NOT. */
export async function revalidateTenant(host: string): Promise<void> {
  revalidateTag(tenantTag(host));
}
