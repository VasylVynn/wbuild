import Link from "next/link";
import { isAuthConfigured, getUser } from "@/lib/supabase/auth";
import { Wordmark } from "@/components/ui";

/**
 * Dashboard home (served on app.<root> — see middleware). Deliberately PUBLIC:
 * anonymous onboarding ("create a site without registering") starts here. But
 * it is auth-aware — a signed-out visitor gets a prominent «Увійти» instead of
 * management links that would just bounce off the (protected) gate.
 */

// Link needs to render an <a>, so we mirror Button's primary/secondary look
// here directly rather than nesting a <button> inside it (invalid HTML).
const primaryLink =
  "inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-[16px] bg-brand px-7 font-ui text-[18px] font-bold text-white shadow-[0_8px_24px_rgba(27,91,191,0.3)] transition-colors hover:bg-brand-hover";
const secondaryLink =
  "inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-[16px] border-[1.5px] border-line-strong bg-surface px-7 font-ui text-[18px] font-bold text-ink transition-colors hover:bg-sunken";

export default async function Dashboard() {
  const user = isAuthConfigured() ? await getUser() : null;
  const authOn = isAuthConfigured();

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center gap-3 bg-canvas px-6 py-24 text-center">
      <Wordmark className="text-[28px]" />
      <h1 className="mt-4 text-[18px] font-normal leading-relaxed text-ink-muted">
        Створіть свій сайт у простій розмові з помічником — і отримуйте заявки клієнтів у
        Telegram.
      </h1>
      <div className="mt-5 flex w-full max-w-sm flex-col gap-3">
        <Link href="/new" className={primaryLink}>
          Створити сайт
        </Link>
        {authOn && !user ? (
          <Link href="/login" className={secondaryLink}>
            Увійти
          </Link>
        ) : (
          <>
            <Link href="/sites" className={secondaryLink}>
              Мої сайти
            </Link>
            <Link href="/leads" className={secondaryLink}>
              Заявки
            </Link>
          </>
        )}
      </div>
      {user && <p className="mt-2 text-[15px] font-semibold text-ink-faint">{user.email}</p>}
    </main>
  );
}
