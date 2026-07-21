"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface MiniLesson {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  errorLabel: string;
  criterion: string;
  planUnitTitle: string | null;
}

async function fetchLessons(): Promise<MiniLesson[]> {
  const res = await fetch("/api/teacher/lessons");
  const data = (await res.json()) as { lessons: MiniLesson[]; error?: string };
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
  return data.lessons;
}

export default function LessonsPage() {
  const [lessons, setLessons] = useState<MiniLesson[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchLessons()
      .then(setLessons)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load lessons"));
  }, []);

  return (
    <div className="flex flex-1 flex-col items-center bg-zinc-50 px-4 py-10 dark:bg-black">
      <main className="flex w-full max-w-3xl flex-col gap-8">
        <header>
          <h1 className="text-2xl font-semibold text-zinc-950 dark:text-zinc-50">Mini-Lessons</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Written by your tutor whenever an error keeps showing up in your work.
          </p>
          <Link
            href="/plan"
            className="mt-2 inline-block text-sm text-zinc-500 underline hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            ← Back to your plan
          </Link>
        </header>

        {error && (
          <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
            {error}
          </div>
        )}

        {lessons && lessons.length === 0 && (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            No mini-lessons yet — these appear once an error shows up persistently across your
            sessions.
          </p>
        )}

        <div className="flex flex-col gap-6">
          {lessons?.map((lesson) => (
            <article
              key={lesson.id}
              id={lesson.id}
              className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950"
            >
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-semibold text-zinc-950 dark:text-zinc-50">{lesson.title}</h2>
                <span className="rounded-full bg-zinc-100 px-2 py-1 text-xs text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
                  {lesson.criterion} — {lesson.errorLabel}
                </span>
                {lesson.planUnitTitle && (
                  <span className="rounded-full bg-violet-100 px-2 py-1 text-xs text-violet-700 dark:bg-violet-950 dark:text-violet-300">
                    {lesson.planUnitTitle}
                  </span>
                )}
              </div>
              <p className="whitespace-pre-line text-sm text-zinc-700 dark:text-zinc-300">
                {lesson.content}
              </p>
            </article>
          ))}
        </div>
      </main>
    </div>
  );
}
