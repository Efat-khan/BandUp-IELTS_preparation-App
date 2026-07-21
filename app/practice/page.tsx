import Link from "next/link";

interface PracticeModeCard {
  href: string;
  title: string;
  description: string;
}

const WRITING_MODES: PracticeModeCard[] = [
  {
    href: "/practice/writing",
    title: "Task 2 quick drill",
    description: "Generate a single Task 2 essay question and get it scored on its own.",
  },
  {
    href: "/practice/writing/task1",
    title: "Task 1 quick drill",
    description: "Academic chart/table/process/map, or a General Training letter.",
  },
  {
    href: "/practice/writing/mock",
    title: "Full Writing mock",
    description: "Timed Task 1 + Task 2 (60 minutes), scored together for an overall band.",
  },
];

const SPEAKING_MODES: PracticeModeCard[] = [
  {
    href: "/practice/speaking/drill",
    title: "Part 1 or Part 2 quick drill",
    description: "Practice a single topic set or cue card, scored on its own.",
  },
  {
    href: "/practice/speaking",
    title: "Full Speaking mock",
    description: "Part 1 + Part 2 (cue card) + Part 3, recorded and scored together.",
  },
];

function ModeCard({ href, title, description }: PracticeModeCard) {
  return (
    <Link
      href={href}
      className="flex flex-col gap-1.5 rounded-lg border border-zinc-200 bg-white p-4 transition-colors hover:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-600"
    >
      <span className="font-medium text-zinc-900 dark:text-zinc-100">{title}</span>
      <span className="text-sm text-zinc-500 dark:text-zinc-400">{description}</span>
    </Link>
  );
}

export default function PracticeHubPage() {
  return (
    <div className="flex flex-1 flex-col items-center bg-zinc-50 px-4 py-10 dark:bg-black">
      <main className="flex w-full max-w-3xl flex-col gap-10">
        <header>
          <h1 className="text-2xl font-semibold text-zinc-950 dark:text-zinc-50">Practice</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Every question is generated fresh and de-duplicated against your recent history — you
            won&apos;t see the same topic twice in a row.
          </p>
          <Link
            href="/progress"
            className="mt-2 inline-block text-sm text-zinc-500 underline hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            View your progress dashboard →
          </Link>
        </header>

        <section className="flex flex-col gap-3 rounded-lg border border-violet-300 bg-violet-50 p-5 dark:border-violet-800 dark:bg-violet-950">
          <div className="flex flex-col gap-1">
            <h2 className="font-semibold text-violet-900 dark:text-violet-200">Weakness drill</h2>
            <p className="text-sm text-violet-800 dark:text-violet-300">
              Automatically serves a task targeting your single lowest-scoring criterion across
              every scored attempt — Writing or Speaking, whichever needs it most.
            </p>
          </div>
          <Link
            href="/practice/weakness"
            className="w-fit rounded-full bg-violet-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-violet-800 dark:bg-violet-600 dark:hover:bg-violet-500"
          >
            Start weakness drill
          </Link>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="font-semibold text-zinc-950 dark:text-zinc-50">Writing</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {WRITING_MODES.map((mode) => (
              <ModeCard key={mode.href} {...mode} />
            ))}
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="font-semibold text-zinc-950 dark:text-zinc-50">Speaking</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {SPEAKING_MODES.map((mode) => (
              <ModeCard key={mode.href} {...mode} />
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
