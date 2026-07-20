"use client";

import { useState } from "react";
import { FluencyTimeline } from "./FluencyTimeline";
import { SpeechRateGauge } from "./SpeechRateGauge";
import type { TranscribedWord } from "@/lib/stt/transcribe";

export type SpeakingCriterionId = "FC" | "LR" | "GRA" | "PR";

export interface SpeakingCriterionResult {
  criterion: SpeakingCriterionId;
  band: number;
  evidence: string[];
  why: string;
}

export interface UpgradePhraseResult {
  original: string;
  upgraded: string;
  reason: string;
}

export interface AcousticFeaturesResult {
  totalWords: number;
  totalDurationSeconds: number;
  speechRateWpm: number;
  filledPauseCount: number;
  silentPauseCount: number;
  totalSilentPauseSeconds: number;
  meanLengthOfRun: number;
  selfCorrectionCount: number;
  selfCorrectionRatePer100Words: number;
  meanWordConfidence: number;
}

export interface SpeakingResult {
  sessionId: string;
  overallBand?: number;
  overallUnrounded?: number;
  disagreementFlagged: boolean;
  modelSelfEstimatedBand?: number;
  pronunciationSource: "MEASURED" | "ESTIMATED";
  criteria: SpeakingCriterionResult[];
  upgradePhrases: UpgradePhraseResult[];
  acousticFeatures: {
    part1: AcousticFeaturesResult;
    part2: AcousticFeaturesResult;
    part3: AcousticFeaturesResult;
  };
  usedNativeAudio: boolean;
}

const CRITERION_LABELS: Record<SpeakingCriterionId, string> = {
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

interface SpeakingResultsViewProps {
  result: SpeakingResult;
  part2Words: TranscribedWord[];
  part2QuestionId: string;
}

export function SpeakingResultsView({ result, part2Words, part2QuestionId }: SpeakingResultsViewProps) {
  const [targetBand, setTargetBand] = useState(Math.min(9, (result.overallBand ?? 6) + 1));
  const [modelAnswer, setModelAnswer] = useState<{ text: string; disclaimer: string } | null>(null);
  const [loadingModelAnswer, setLoadingModelAnswer] = useState(false);
  const [modelAnswerError, setModelAnswerError] = useState<string | null>(null);

  async function handleModelAnswer() {
    setLoadingModelAnswer(true);
    setModelAnswerError(null);
    try {
      const data = await postJson<{ modelAnswer: string; disclaimer: string }>(
        "/api/speaking/model-answer",
        { questionId: part2QuestionId, targetBand },
      );
      setModelAnswer({ text: data.modelAnswer, disclaimer: data.disclaimer });
    } catch (e) {
      setModelAnswerError(e instanceof Error ? e.message : "Failed to generate model answer");
    } finally {
      setLoadingModelAnswer(false);
    }
  }

  return (
    <section className="flex flex-col gap-6">
      <div className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
            Overall Speaking band: {result.overallBand !== undefined ? result.overallBand.toFixed(1) : "—"}
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
        {result.usedNativeAudio && (
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Pronunciation was informed by the raw Part 2 recording (native audio input), not the
            transcript alone.
          </p>
        )}
      </div>

      <div>
        <h3 className="mb-2 font-medium text-zinc-900 dark:text-zinc-100">
          Fluency timeline — Part 2
        </h3>
        <FluencyTimeline words={part2Words} />
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <h3 className="mb-2 font-medium text-zinc-900 dark:text-zinc-100">Speech rate — Part 2</h3>
        <SpeechRateGauge wpm={result.acousticFeatures.part2.speechRateWpm} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {result.criteria.map((c) => (
          <div
            key={c.criterion}
            className="flex flex-col gap-2 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"
          >
            <div className="flex items-baseline justify-between">
              <h3 className="flex items-center gap-2 font-medium text-zinc-900 dark:text-zinc-100">
                {CRITERION_LABELS[c.criterion]}
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
                <span className="text-zinc-500 line-through dark:text-zinc-500">{u.original}</span>{" "}
                → <span className="font-medium text-zinc-900 dark:text-zinc-100">{u.upgraded}</span>
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">{u.reason}</p>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
        <h3 className="mb-1 font-medium text-zinc-900 dark:text-zinc-100">Model cue-card answer</h3>
        <p className="mb-3 text-xs text-zinc-500 dark:text-zinc-400">
          Hear what a stronger answer to your Part 2 cue card could sound like. AI-generated — not
          something to memorize and recite verbatim.
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
        {modelAnswerError && (
          <p className="mb-2 text-sm text-red-700 dark:text-red-400">{modelAnswerError}</p>
        )}
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
    </section>
  );
}
