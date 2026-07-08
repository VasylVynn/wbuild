"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { claimSitesAction } from "@/app/app/(protected)/sites/actions";

/**
 * On the sites page, binds sites the user created anonymously before they
 * registered (§3.1). OnboardChat stashes {host, token} pairs in localStorage
 * (`vitryna_claims`); here we hand them to claimSitesAction, drop every
 * processed entry (claimed or rejected — the token is single-use), and refresh
 * so newly-owned sites appear. Renders nothing.
 */
const STORAGE_KEY = "vitryna_claims";

type Claim = { host: string; token: string };

function readClaims(): Claim[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (c): c is Claim =>
        !!c && typeof c.host === "string" && typeof c.token === "string",
    );
  } catch {
    return [];
  }
}

export default function ClaimSites() {
  const router = useRouter();
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return; // guard against StrictMode double-invoke
    ran.current = true;

    const claims = readClaims();
    if (claims.length === 0) return;

    claimSitesAction(claims)
      .then(({ claimed, rejected }) => {
        const processed = new Set([...claimed, ...rejected]);
        const remaining = readClaims().filter((c) => !processed.has(c.host));
        if (remaining.length > 0) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(remaining));
        } else {
          localStorage.removeItem(STORAGE_KEY);
        }
        if (claimed.length > 0) router.refresh();
      })
      .catch(() => {
        // Leave localStorage intact so the next visit retries.
      });
  }, [router]);

  return null;
}
