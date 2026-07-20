"use client";

import { useState } from "react";
import { AudioRecorder } from "@/components/AudioRecorder";
import { SpeakingResultsView, type SpeakingResult } from "@/components/SpeakingResultsView";
import type { TranscribedWord } from "@/lib/stt/transcribe";

interface Part1Contract {
  topics: Array<{ topic: string; questions: string[] }>;
  instructions: string;
}
interface Part2Contract {
  cue_card_topic: string;
  bullet_points: string[];
  final_prompt: string;
  prep_seconds: number;
  speaking_seconds: number;
  instructions: string;
}
interface Part3Contract {
  questions: string[];
  instructions: string;
}

interface StartResponse {
  sessionId: string;
  part1: { questionId: string; contract: Part1Contract };
  part2: { questionId: string; contract: Part2Contract };
  part3: { questionId: string; contract: Part3Contract };
}

interface SubmitPartResponse {
  submissionId: string;
  part: "part1" | "part2" | "part3";
  audioUrl: string;
  transcript: string;
  wordTimestamps: TranscribedWord[];
}

type PartKey = "part1" | "part2" | "part3";

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as T & { error?: string };
  if (!res.ok) throw new Error(data.error ?? `Request to ${url} failed (${res.status})`);
  return data;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1] ?? "");
    };
    reader.onerror = () => reject(new Error("Failed to read the recorded audio"));
    reader.readAsDataURL(blob);
  });
}

export default function SpeakingPracticePage() {
  const [session, setSession] = useState<StartResponse | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [submissions, setSubmissions] = useState<Partial<Record<PartKey, SubmitPartResponse>>>({});
  const [uploading, setUploading] = useState<PartKey | null>(null);

  const [scoring, setScoring] = useState(false);
  const [result, setResult] = useState<SpeakingResult | null>(null);

  async function handleStart() {
    setStarting(true);
    setError(null);
    setSession(null);
    setSubmissions({});
    setResult(null);
    try {
      const data = await postJson<StartResponse>("/api/speaking/sessions/start", {});
      setSession(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start speaking session");
    } finally {
      setStarting(false);
    }
  }

  async function submitPart(part: PartKey, blob: Blob, mimeType: string) {
    if (!session) return;
    setUploading(part);
    setError(null);
    try {
      const audioBase64 = await blobToBase64(blob);
      const data = await postJson<SubmitPartResponse>(
        `/api/speaking/sessions/${session.sessionId}/submit-part`,
        { part, audioBase64, mimeType },
      );
      setSubmissions((prev) => ({ ...prev, [part]: data }));
    } catch (e) {
      setError(e instanceof Error ? e.message : `Failed to submit ${part}`);
    } finally {
      setUploading(null);
    }
  }

  async function handleScore() {
    if (!session) return;
    setScoring(true);
    setError(null);
    try {
      const data = await postJson<SpeakingResult>(
        `/api/speaking/sessions/${session.sessionId}/score`,
        {},
      );
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Scoring failed");
    } finally {
      setScoring(false);
    }
  }

  const allPartsRecorded = Boolean(submissions.part1 && submissions.part2 && submissions.part3);

  return (
    <div className="flex flex-1 flex-col items-center bg-zinc-50 px-4 py-10 dark:bg-black">
      <main className="flex w-full max-w-3xl flex-col gap-8">
        <header>
          <h1 className="text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
            Speaking Practice
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            A full Part 1 + Part 2 (cue card) + Part 3 test, recorded, transcribed, and scored
            together as one holistic Speaking band.
          </p>
        </header>

        {error && (
          <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
            {error}
          </div>
        )}

        {!session && (
          <button
            type="button"
            onClick={handleStart}
            disabled={starting}
            className="w-fit rounded-full bg-foreground px-5 py-3 text-sm font-medium text-background transition-colors hover:bg-[#383838] disabled:opacity-50 dark:hover:bg-[#ccc]"
          >
            {starting ? "Generating…" : "Start Speaking Test"}
          </button>
        )}

        {session && !result && (
          <>
            <section className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
              <h2 className="font-semibold text-zinc-950 dark:text-zinc-50">Part 1</h2>
              {session.part1.contract.topics.map((t, i) => (
                <div key={i}>
                  <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{t.topic}</p>
                  <ul className="list-disc pl-5 text-sm text-zinc-600 dark:text-zinc-400">
                    {t.questions.map((q, j) => (
                      <li key={j}>{q}</li>
                    ))}
                  </ul>
                </div>
              ))}
              <p className="text-xs italic text-zinc-500 dark:text-zinc-400">
                {session.part1.contract.instructions}
              </p>
              <AudioRecorder
                onRecordingComplete={(blob, mime) => submitPart("part1", blob, mime)}
                disabled={Boolean(submissions.part1) || uploading === "part1"}
              />
              {uploading === "part1" && (
                <p className="text-xs text-zinc-500 dark:text-zinc-400">Uploading and transcribing…</p>
              )}
              {submissions.part1 && (
                <p className="text-sm text-zinc-700 dark:text-zinc-300">
                  Transcript: {submissions.part1.transcript}
                </p>
              )}
            </section>

            <section className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
              <h2 className="font-semibold text-zinc-950 dark:text-zinc-50">Part 2 — Cue Card</h2>
              <p className="text-sm text-zinc-900 dark:text-zinc-100">
                {session.part2.contract.cue_card_topic}
              </p>
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">You should say:</p>
              <ul className="list-disc pl-5 text-sm text-zinc-600 dark:text-zinc-400">
                {session.part2.contract.bullet_points.map((b, i) => (
                  <li key={i}>{b}</li>
                ))}
              </ul>
              <p className="text-sm text-zinc-900 dark:text-zinc-100">
                {session.part2.contract.final_prompt}
              </p>
              <p className="text-xs italic text-zinc-500 dark:text-zinc-400">
                {session.part2.contract.instructions}
              </p>
              <AudioRecorder
                prepSeconds={session.part2.contract.prep_seconds}
                maxSpeakingSeconds={session.part2.contract.speaking_seconds}
                onRecordingComplete={(blob, mime) => submitPart("part2", blob, mime)}
                disabled={Boolean(submissions.part2) || uploading === "part2"}
              />
              {uploading === "part2" && (
                <p className="text-xs text-zinc-500 dark:text-zinc-400">Uploading and transcribing…</p>
              )}
              {submissions.part2 && (
                <p className="text-sm text-zinc-700 dark:text-zinc-300">
                  Transcript: {submissions.part2.transcript}
                </p>
              )}
            </section>

            <section className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
              <h2 className="font-semibold text-zinc-950 dark:text-zinc-50">Part 3</h2>
              <ul className="list-disc pl-5 text-sm text-zinc-600 dark:text-zinc-400">
                {session.part3.contract.questions.map((q, i) => (
                  <li key={i}>{q}</li>
                ))}
              </ul>
              <p className="text-xs italic text-zinc-500 dark:text-zinc-400">
                {session.part3.contract.instructions}
              </p>
              <AudioRecorder
                onRecordingComplete={(blob, mime) => submitPart("part3", blob, mime)}
                disabled={Boolean(submissions.part3) || uploading === "part3"}
              />
              {uploading === "part3" && (
                <p className="text-xs text-zinc-500 dark:text-zinc-400">Uploading and transcribing…</p>
              )}
              {submissions.part3 && (
                <p className="text-sm text-zinc-700 dark:text-zinc-300">
                  Transcript: {submissions.part3.transcript}
                </p>
              )}
            </section>

            <button
              type="button"
              onClick={handleScore}
              disabled={!allPartsRecorded || scoring}
              className="w-fit rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-colors hover:bg-[#383838] disabled:opacity-50 dark:hover:bg-[#ccc]"
            >
              {scoring ? "Scoring…" : "Score my Speaking test"}
            </button>
          </>
        )}

        {result && submissions.part2 && session && (
          <SpeakingResultsView
            result={result}
            part2Words={submissions.part2.wordTimestamps}
            part2QuestionId={session.part2.questionId}
          />
        )}
      </main>
    </div>
  );
}
