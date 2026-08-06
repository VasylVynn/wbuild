"use client";

import { useEffect } from "react";
import { phIdentify } from "./PostHogProvider";

/**
 * Client shim so a server layout that already resolved the session can hand the
 * owner to PostHog without becoming a client component itself. Renders nothing.
 */
export function PostHogIdentify({ userId, email }: { userId: string; email?: string }) {
  useEffect(() => {
    phIdentify(userId, email);
  }, [userId, email]);

  return null;
}
