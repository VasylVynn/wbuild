import { notFound } from "next/navigation";
import { getEditorData } from "../actions";
import EditorShell from "@/components/editor/EditorShell";

// regenerateSite runs thinking-generation (~35s) + one schema retry — headroom.
export const maxDuration = 120;

/**
 * Editor page, reached at app.<root>/edit/<tenant-host> (middleware rewrites the
 * app host into /app). Loads the tenant's DRAFT via getEditorData and hands it
 * to the client shell; 404 if the host is unknown.
 */
export default async function EditPage({
  params,
}: {
  params: Promise<{ host: string }>;
}) {
  const { host } = await params;
  const data = await getEditorData(decodeURIComponent(host));
  if (!data) notFound();
  return <EditorShell initial={data} />;
}
