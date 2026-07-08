import Link from "next/link";
import { isAuthConfigured, getUser } from "@/lib/supabase/auth";

/**
 * Dashboard home (served on app.<root> — see middleware). Deliberately PUBLIC:
 * anonymous onboarding ("create a site without registering") starts here. But
 * it is auth-aware — a signed-out visitor gets a prominent «Увійти» instead of
 * management links that would just bounce off the (protected) gate.
 */
export default async function Dashboard() {
  const user = isAuthConfigured() ? await getUser() : null;
  const authOn = isAuthConfigured();

  const primary =
    "inline-block rounded-full bg-neutral-900 px-8 py-4 text-lg font-medium text-white transition hover:bg-neutral-700";
  const secondary =
    "inline-block rounded-full border border-neutral-300 px-8 py-4 text-lg font-medium text-neutral-800 transition hover:bg-neutral-100";

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center px-6 py-24 text-center">
      <h1 className="text-3xl font-bold tracking-tight text-neutral-900">Вітрина</h1>
      <p className="mt-3 text-lg text-neutral-600">
        Створіть свій сайт у простій розмові з помічником.
      </p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Link href="/new" className={primary}>
          Створити сайт
        </Link>
        {authOn && !user ? (
          <Link href="/login" className={secondary}>
            Увійти
          </Link>
        ) : (
          <>
            <Link href="/sites" className={secondary}>
              Мої сайти
            </Link>
            <Link href="/leads" className={secondary}>
              Заявки
            </Link>
          </>
        )}
      </div>
      {user && <p className="mt-6 text-sm text-neutral-400">{user.email}</p>}
    </main>
  );
}
