import { ROOT_DOMAIN } from "@/lib/config";

/**
 * Platform marketing stub — served on the root/platform hosts (§2.5).
 * The dashboard/editor (app.<root>) will get its own routes later; for now the
 * platform hosts share this placeholder.
 */
export default function PlatformHome() {
  const demoHost = `kvity.${ROOT_DOMAIN}`;
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center px-6 py-24 text-center">
      <h1 className="text-4xl font-bold tracking-tight text-neutral-900">Вітрина</h1>
      <p className="mt-4 text-lg text-neutral-600">
        AI-конструктор сайтів для малого бізнесу. Тут буде лендінг платформи.
      </p>
      <p className="mt-10 text-sm text-neutral-400">
        Демо-сайт орендаря:{" "}
        <a className="underline hover:text-neutral-600" href={`http://${demoHost}`}>
          {demoHost}
        </a>
      </p>
    </main>
  );
}
