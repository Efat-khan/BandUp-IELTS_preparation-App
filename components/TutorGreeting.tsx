"use client";

import { useEffect, useState } from "react";

interface GreetingResponse {
  greeting: string;
  milestones: string[];
}

async function fetchGreeting(): Promise<GreetingResponse> {
  const res = await fetch("/api/teacher/greeting");
  const data = (await res.json()) as GreetingResponse & { error?: string };
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
  return data;
}

/** The tutor's greeting on the dashboard — celebrates real, freshly-computed milestones by name, never generic praise. */
export function TutorGreeting() {
  const [data, setData] = useState<GreetingResponse | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchGreeting()
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (failed) return null;
  if (!data) {
    return (
      <div className="rounded-lg border border-violet-200 bg-violet-50 p-4 text-sm text-violet-700 dark:border-violet-900 dark:bg-violet-950 dark:text-violet-300">
        Your tutor is checking your progress…
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-violet-300 bg-violet-50 p-5 dark:border-violet-800 dark:bg-violet-950">
      <div className="flex items-start gap-3">
        <span className="text-2xl" aria-hidden>
          🎓
        </span>
        <p className="text-sm text-violet-950 dark:text-violet-100">{data.greeting}</p>
      </div>
      {data.milestones.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {data.milestones.map((m) => (
            <span
              key={m}
              className="rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-medium text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
            >
              🏅 {m}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
