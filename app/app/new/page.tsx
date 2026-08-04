import { OnboardChat } from "@/components/onboard/OnboardChat";
import { isApifyConfigured } from "@/lib/ig/apify";
import { MetaPixel } from "@/lib/analytics/pixel";

// Server actions invoked from this page inherit its budget. generateDraftAction
// runs the full draft generation (build_site + stylesheet + quality loop, 04 §2);
// 180s so it never 504s (live incident 2026-07-22). finalizeAction (publish-only)
// is fast.
export const maxDuration = 180;

/** Onboarding page (app.<root>/new). The chat drives fact collection → generate.
 *  The Instagram-first flow (wave E) exists only when Apify is configured —
 *  the flag rides a prop so the client never guesses at server env. */
export default function NewSitePage() {
  return (
    <>
      <MetaPixel />
      <OnboardChat igImportEnabled={isApifyConfigured()} />
    </>
  );
}
