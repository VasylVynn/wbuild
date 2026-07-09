import { OnboardChat } from "@/components/onboard/OnboardChat";

// Server actions invoked from this page inherit its budget. finalizeAction runs
// thinking-generation (~35s) with one schema retry — 120s keeps the retry path.
export const maxDuration = 120;

/** Onboarding page (app.<root>/new). The chat drives fact collection → generate. */
export default function NewSitePage() {
  return <OnboardChat />;
}
