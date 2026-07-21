"use client";

import Link from "next/link";
import { SpeakingDrillFlow } from "@/components/SpeakingDrillFlow";

export default function SpeakingDrillPage() {
  return (
    <div className="flex flex-1 flex-col items-center bg-zinc-50 px-4 py-10 dark:bg-black">
      <main className="flex w-full max-w-3xl flex-col gap-8">
        <header>
          <h1 className="text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
            Speaking Quick Drill
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Practice a single Part 1 topic set or a single Part 2 cue card — scored on its own,
            no need for a full three-part test.
          </p>
          <Link
            href="/practice/speaking"
            className="mt-2 inline-block text-sm text-zinc-500 underline hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            Prefer the full test? Go to the full Speaking mock →
          </Link>
        </header>
        <SpeakingDrillFlow />
      </main>
    </div>
  );
}
