import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-zinc-50 px-4 dark:bg-black">
      <main className="flex w-full max-w-2xl flex-col items-center gap-6 py-32 text-center">
        <h1 className="text-4xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
          BandUp
        </h1>
        <p className="max-w-md text-lg text-zinc-600 dark:text-zinc-400">
          An AI-powered IELTS Writing &amp; Speaking tutor — evidence-based band scores, inline
          feedback, and a progress dashboard that tracks every criterion over time.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link
            href="/practice"
            className="rounded-full bg-foreground px-6 py-3 text-sm font-medium text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]"
          >
            Start practicing
          </Link>
          <Link
            href="/progress"
            className="rounded-full border border-zinc-300 px-6 py-3 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            View progress dashboard
          </Link>
        </div>
      </main>
    </div>
  );
}
