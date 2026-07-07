import Link from "next/link";

/** Dashboard home (served on app.<root> — see middleware). MVP stub. */
export default function Dashboard() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center px-6 py-24 text-center">
      <h1 className="text-3xl font-bold tracking-tight text-neutral-900">Вітрина</h1>
      <p className="mt-3 text-lg text-neutral-600">
        Створіть свій сайт у простій розмові з помічником.
      </p>
      <Link
        href="/new"
        className="mt-8 inline-block rounded-full bg-neutral-900 px-8 py-4 text-lg font-medium text-white transition hover:bg-neutral-700"
      >
        Створити сайт
      </Link>
    </main>
  );
}
