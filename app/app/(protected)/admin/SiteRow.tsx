"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { adminSetTenantStatus } from "./actions";
import { Button, ConfirmDialog } from "@/components/ui";

/**
 * Per-site kill-switch control for the admin table. Suspend/restore is a
 * confirm-gated, rare, outward-facing action (it changes what visitors see) —
 * hence the ConfirmDialog rather than a bare click.
 */
export default function SiteRow({
  tenantId,
  host,
  suspended,
}: {
  tenantId: string;
  host: string;
  suspended: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function confirm() {
    setBusy(true);
    setError("");
    try {
      const result = await adminSetTenantStatus(tenantId, suspended ? "restore" : "suspend");
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setOpen(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button
        variant={suspended ? "secondary" : "danger"}
        size="sm"
        onClick={() => setOpen(true)}
      >
        {suspended ? "Відновити" : "Призупинити"}
      </Button>
      {error && <span className="block text-[13px] font-semibold text-danger">{error}</span>}
      <ConfirmDialog
        open={open}
        title={suspended ? "Відновити сайт?" : "Призупинити сайт?"}
        body={
          suspended
            ? `Сайт ${host} знову стане доступним відвідувачам.`
            : `Сайт ${host} перестане відкриватися для відвідувачів. Призупинити?`
        }
        confirmLabel={suspended ? "Відновити" : "Призупинити"}
        onConfirm={confirm}
        onCancel={() => setOpen(false)}
        busy={busy}
      />
    </>
  );
}
