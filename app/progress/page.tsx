"use client";

import Link from "next/link";
import { ProgressDashboard } from "@/components/ProgressDashboard";
import { TutorGreeting } from "@/components/TutorGreeting";

export default function ProgressPage() {
  return (
    <div className="flex flex-1 flex-col items-center bg-zinc-50 px-4 py-10 dark:bg-black">
      <main className="flex w-full max-w-4xl flex-col gap-8">
        <header>
          <h1 className="text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
            Progress Dashboard
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Band trends, weaknesses, and streaks across every scored practice attempt.
          </p>
          <Link
            href="/practice"
            className="mt-2 inline-block text-sm text-zinc-500 underline hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            ← Back to practice modes
          </Link>
        </header>
        <TutorGreeting />
        <ProgressDashboard />
      </main>
    </div>
  );
}
