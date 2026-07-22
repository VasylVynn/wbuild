import { OnboardChat } from "@/components/onboard/OnboardChat";
import { isApifyConfigured } from "@/lib/ig/apify";

// Server actions invoked from this page inherit its budget. finalizeAction runs
// thinking-generation with one schema retry; 180s: generation with thinking retries once (2x ~45s) and the finalize
// path must never 504 under it (live incident 2026-07-22).
export const maxDuration = 180;

/** Onboarding page (app.<root>/new). The chat drives fact collection → generate.
 *  The Instagram-first flow (wave E) exists only when Apify is configured —
 *  the flag rides a prop so the client never guesses at server env. */
export default function NewSitePage() {
  return <OnboardChat igImportEnabled={isApifyConfigured()} />;
}
