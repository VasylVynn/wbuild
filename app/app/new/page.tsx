import { OnboardChat } from "@/components/onboard/OnboardChat";
import { isApifyConfigured } from "@/lib/ig/apify";
import { MetaPixel } from "@/lib/analytics/pixel";

// Server actions invoked from this page inherit its budget. generateDraftAction
// runs the full draft generation (build_site + stylesheet + quality loop, 04 §2);
// 180s wasn't always enough with photo analysis + IG import in the mix — live
// 504 FUNCTION_INVOCATION_TIMEOUT on 2026-08-06 (first was 2026-07-22 at the
// old default). 300 now, matching the editor and admin generate pages.
export const maxDuration = 300;

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
