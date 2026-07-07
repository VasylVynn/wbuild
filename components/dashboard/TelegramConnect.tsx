"use client";

import { useState } from "react";
import { getTelegramConnectLink } from "@/app/app/sites/actions";

interface TelegramConnectProps {
  tenantId: string;
  connected: boolean;
}

/**
 * Inline Telegram connect control for the sites list.
 * If connected — shows a static green chip.
 * If not — button that fetches the deep-link and opens it.
 */
export default function TelegramConnect({ tenantId, connected }: TelegramConnectProps) {
  const [state, setState] = useState<"idle" | "loading" | "opened" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  if (connected) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-800">
        Telegram ✓
      </span>
    );
  }

  if (state === "opened") {
    return (
      <span className="inline-flex items-center rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium text-neutral-600">
        Відкрийте Telegram і натисніть Start
      </span>
    );
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
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={handleConnect}
        disabled={state === "loading"}
        className="shrink-0 rounded-full border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-800 transition hover:bg-neutral-100 disabled:opacity-50"
      >
        {state === "loading" ? "…" : "Підключити Telegram"}
      </button>
      {state === "error" && (
        <span className="text-xs text-red-600">{errorMsg}</span>
      )}
    </div>
  );
}
