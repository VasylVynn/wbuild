"use client";

import { useState } from "react";
import { getTelegramConnectLink } from "@/app/app/(protected)/sites/actions";
import { Button, Chip } from "@/components/ui";

interface TelegramConnectProps {
  tenantId: string;
  connected: boolean;
}

/**
 * Inline Telegram connect control for the sites list.
 * If connected — shows a static ok chip.
 * If not — button that fetches the deep-link and opens it.
 */
export default function TelegramConnect({ tenantId, connected }: TelegramConnectProps) {
  const [state, setState] = useState<"idle" | "loading" | "opened" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  if (connected) {
    return <Chip tone="ok">Telegram ✓</Chip>;
  }

  if (state === "opened") {
    return <Chip tone="neutral">Відкрийте Telegram і натисніть Start</Chip>;
  }

  async function handleConnect() {
    setState("loading");
    const result = await getTelegramConnectLink(tenantId);
    if (!result.ok) {
      setErrorMsg(result.error);
      setState("error");
      return;
    }
    window.open(result.link, "_blank");
    setState("opened");
  }

  return (
    <div className="flex w-full flex-col items-start gap-1.5">
      <Button
        variant="telegram"
        size="md"
        onClick={handleConnect}
        disabled={state === "loading"}
        className="w-full"
      >
        {state === "loading" ? "…" : "Підключити Telegram"}
      </Button>
      {state === "error" && (
        <span className="text-[13px] font-semibold text-danger">{errorMsg}</span>
      )}
    </div>
  );
}
