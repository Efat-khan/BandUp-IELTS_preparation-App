"use client";

import { useState } from "react";
import { AudioRecorder } from "./AudioRecorder";
import { FluencyTimeline } from "./FluencyTimeline";
import { SpeechRateGauge } from "./SpeechRateGauge";
import { TutorChat } from "./TutorChat";
import { TutorFeedback } from "./TutorFeedback";
import type {
  AcousticFeaturesResult,
  SpeakingCriterionResult,
  UpgradePhraseResult,
} from "./SpeakingResultsView";
import type { TranscribedWord } from "@/lib/stt/transcribe";

export type DrillPart = "part1" | "part2";

export interface DrillQuestion {
  id: string;
  part: DrillPart;
  topics?: Array<{ topic: string; questions: string[] }>;
  topic_tag?: string;
  cue_card_topic?: string;
  bullet_points?: string[];
  final_prompt?: string;
  prep_seconds?: number;
  speaking_seconds?: number;
  instructions: string;
}

interface DrillResult {
  submissionId: string;
  part: DrillPart;
  transcript: string;
  wordTimestamps: TranscribedWord[];
  overallBand?: number;
  overallUnrounded?: number;
  disagreementFlagged: boolean;
  modelSelfEstimatedBand?: number;
  pronunciationSource: "MEASURED" | "ESTIMATED";
  criteria: SpeakingCriterionResult[];
  upgradePhrases: UpgradePhraseResult[];
  acousticFeatures: AcousticFeaturesResult;
}

const CRITERION_LABELS: Record<string, string> = {
  FC: "Fluency & Coherence",
  LR: "Lexical Resource",
  GRA: "Grammatical Range & Accuracy",
  PR: "Pronunciation",
};

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

interface SpeakingDrillFlowProps {
  /** When provided (e.g. from the weakness-drill route), skips the generate step entirely. */
  initialQuestion?: DrillQuestion;
  /** Called with the scored submission's id once results arrive (e.g. so the diagnostic flow can hand it to /api/diagnostic/complete). */
  onComplete?: (submissionId: string) => void;
}

export function SpeakingDrillFlow({ initialQuestion, onComplete }: SpeakingDrillFlowProps) {
  const [part, setPart] = useState<DrillPart>(initialQuestion?.part ?? "part2");
  const [question, setQuestion] = useState<DrillQuestion | null>(initialQuestion ?? null);
  const [generating, setGenerating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<DrillResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [targetBand, setTargetBand] = useState(7);
  const [modelAnswer, setModelAnswer] = useState<{ text: string; disclaimer: string } | null>(null);
  const [loadingModelAnswer, setLoadingModelAnswer] = useState(false);

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    setResult(null);
    setQuestion(null);
    try {
      const data = await postJson<DrillQuestion>("/api/speaking/drill/start", { part });
      setQuestion(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate a drill question");
    } finally {
      setGenerating(false);
    }
  }

  async function handleRecordingComplete(blob: Blob, mimeType: string) {
    if (!question) return;
    setUploading(true);
    setError(null);
    try {
      const audioBase64 = await blobToBase64(blob);
      const data = await postJson<DrillResult>("/api/speaking/drill/submit", {
        questionId: question.id,
        audioBase64,
        mimeType,
      });
      setResult(data);
      onComplete?.(data.submissionId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Scoring failed");
    } finally {
      setUploading(false);
    }
  }

  async function handleModelAnswer() {
    if (!question) return;
    setLoadingModelAnswer(true);
    try {
      const data = await postJson<{ modelAnswer: string; disclaimer: string }>(
        "/api/speaking/model-answer",
        { questionId: question.id, targetBand },
      );
      setModelAnswer({ text: data.modelAnswer, disclaimer: data.disclaimer });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate model answer");
    } finally {
      setLoadingModelAnswer(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {error && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          {error}
        </div>
      )}

      {!question && !initialQuestion && (
        <div className="flex flex-col gap-4">
          <div className="flex gap-2">
            {(["part1", "part2"] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPart(p)}
                className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                  part === p
                    ? "bg-foreground text-background"
                    : "border border-zinc-300 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
                }`}
              >
                {p === "part1" ? "Part 1 (Introduction)" : "Part 2 (Cue Card)"}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={generating}
            className="w-fit rounded-full bg-foreground px-5 py-3 text-sm font-medium text-background transition-colors hover:bg-[#383838] disabled:opacity-50 dark:hover:bg-[#ccc]"
          >
            {generating ? "Generating…" : `Generate ${part === "part1" ? "Part 1" : "Part 2"} drill`}
          </button>
        </div>
      )}

      {question && !result && (
        <section className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
          {question.part === "part1" && question.topics && (
            <>
              <h2 className="font-semibold text-zinc-950 dark:text-zinc-50">Part 1</h2>
              {question.topics.map((t, i) => (
                <div key={i}>
                  <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{t.topic}</p>
                  <ul className="list-disc pl-5 text-sm text-zinc-600 dark:text-zinc-400">
                    {t.questions.map((q, j) => (
                      <li key={j}>{q}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </>
          )}
          {question.part === "part2" && (
            <>
              <h2 className="font-semibold text-zinc-950 dark:text-zinc-50">Part 2 — Cue Card</h2>
              <p className="text-sm text-zinc-900 dark:text-zinc-100">{question.cue_card_topic}</p>
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">You should say:</p>
              <ul className="list-disc pl-5 text-sm text-zinc-600 dark:text-zinc-400">
                {question.bullet_points?.map((b, i) => <li key={i}>{b}</li>)}
              </ul>
              <p className="text-sm text-zinc-900 dark:text-zinc-100">{question.final_prompt}</p>
            </>
          )}
          <p className="text-xs italic text-zinc-500 dark:text-zinc-400">{question.instructions}</p>
          <AudioRecorder
            prepSeconds={question.part === "part2" ? question.prep_seconds : undefined}
            maxSpeakingSeconds={question.part === "part2" ? question.speaking_seconds : undefined}
            onRecordingComplete={handleRecordingComplete}
            disabled={uploading}
          />
          {uploading && (
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Uploading, transcribing, and scoring…
            </p>
          )}
        </section>
      )}

      {result && question && (
        <section className="flex flex-col gap-6">
          <TutorFeedback submissionId={result.submissionId} />
          <div className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
            <div className="flex items-baseline justify-between">
              <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
                Overall band: {result.overallBand !== undefined ? result.overallBand.toFixed(1) : "—"}
              </h2>
              {result.overallUnrounded !== undefined && (
                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                  unrounded {result.overallUnrounded.toFixed(3)}
                </span>
              )}
            </div>
            {result.disagreementFlagged && (
              <p className="mt-2 text-sm text-amber-600 dark:text-amber-400">
                The two scoring passes disagreed on at least one criterion — treat this result as
                provisional.
              </p>
            )}
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Scored from {question.part === "part1" ? "Part 1" : "Part 2"} only — a smaller
              evidence base than a full mock, but the same descriptors and guardrails apply.
            </p>
          </div>

          <div>
            <h3 className="mb-2 font-medium text-zinc-900 dark:text-zinc-100">Fluency timeline</h3>
            <FluencyTimeline words={result.wordTimestamps} />
          </div>

          <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
            <h3 className="mb-2 font-medium text-zinc-900 dark:text-zinc-100">Speech rate</h3>
            <SpeechRateGauge wpm={result.acousticFeatures.speechRateWpm} />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {result.criteria.map((c) => (
              <div
                key={c.criterion}
                className="flex flex-col gap-2 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"
              >
                <div className="flex items-baseline justify-between">
                  <h3 className="flex items-center gap-2 font-medium text-zinc-900 dark:text-zinc-100">
                    {CRITERION_LABELS[c.criterion] ?? c.criterion}
                    {c.criterion === "PR" && (
                      <span
                        className={
                          result.pronunciationSource === "MEASURED"
                            ? "rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                            : "rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400"
                        }
                      >
                        {result.pronunciationSource === "MEASURED" ? "measured" : "estimated"}
                      </span>
                    )}
                  </h3>
                  <span className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
                    {c.band.toFixed(1)}
                  </span>
                </div>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">{c.why}</p>
                {c.evidence.length > 0 && (
                  <ul className="flex flex-col gap-1 text-sm">
                    {c.evidence.map((quote, i) => (
                      <li
                        key={i}
                        className="rounded bg-zinc-100 px-2 py-1 italic text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
                      >
                        &ldquo;{quote}&rdquo;
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>

          <div className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
            <h3 className="mb-3 font-medium text-zinc-900 dark:text-zinc-100">Upgrade phrases</h3>
            <ul className="flex flex-col gap-3 text-sm">
              {result.upgradePhrases.map((u, i) => (
                <li key={i} className="border-l-2 border-violet-300 pl-3 dark:border-violet-800">
                  <p>
                    <span className="text-zinc-500 line-through dark:text-zinc-500">
                      {u.original}
                    </span>{" "}
                    → <span className="font-medium text-zinc-900 dark:text-zinc-100">{u.upgraded}</span>
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">{u.reason}</p>
                </li>
              ))}
            </ul>
          </div>

          {question.part === "part2" && (
            <div className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
              <h3 className="mb-1 font-medium text-zinc-900 dark:text-zinc-100">
                Model cue-card answer
              </h3>
              <p className="mb-3 text-xs text-zinc-500 dark:text-zinc-400">
                AI-generated — not something to memorize and recite verbatim.
              </p>
              <div className="mb-3 flex items-center gap-3">
                <label className="text-sm text-zinc-700 dark:text-zinc-300">
                  Target band:{" "}
                  <input
                    type="number"
                    min={4}
                    max={9}
                    step={0.5}
                    value={targetBand}
                    onChange={(e) => setTargetBand(Number(e.target.value))}
                    className="w-16 rounded border border-zinc-300 px-2 py-1 dark:border-zinc-700 dark:bg-zinc-900"
                  />
                </label>
                <button
                  type="button"
                  onClick={handleModelAnswer}
                  disabled={loadingModelAnswer}
                  className="rounded-full border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
                >
                  {loadingModelAnswer ? "Generating…" : `Generate a Band ${targetBand.toFixed(1)} model answer`}
                </button>
              </div>
              {modelAnswer && (
                <div className="rounded-md border border-violet-300 bg-violet-50 p-3 dark:border-violet-800 dark:bg-violet-950">
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-violet-700 dark:text-violet-300">
                    AI-generated example
                  </p>
                  <p className="text-sm text-zinc-800 dark:text-zinc-200">{modelAnswer.text}</p>
                  <p className="mt-2 text-xs italic text-zinc-500 dark:text-zinc-400">
                    {modelAnswer.disclaimer}
                  </p>
                </div>
              )}
            </div>
          )}

          <TutorChat submissionId={result.submissionId} />
        </section>
      )}
    </div>
  );
}
