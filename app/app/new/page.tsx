import { OnboardChat } from "@/components/onboard/OnboardChat";
import { isApifyConfigured } from "@/lib/ig/apify";

// Server actions invoked from this page inherit its budget. finalizeAction runs
// thinking-generation (~35s) with one schema retry — 120s keeps the retry path.
export const maxDuration = 120;

/** Onboarding page (app.<root>/new). The chat drives fact collection → generate.
 *  The Instagram-first flow (wave E) exists only when Apify is configured —
 *  the flag rides a prop so the client never guesses at server env. */
export default function NewSitePage() {
  return <OnboardChat igImportEnabled={isApifyConfigured()} />;
}
