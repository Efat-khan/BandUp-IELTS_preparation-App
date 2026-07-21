/**
 * Populates realistic multi-day Writing + Speaking history for the demo
 * user so the progress dashboard has real data to render.
 *
 * This does NOT fabricate database rows directly and does NOT call Gemini
 * (no API key is configured in this environment). Instead it hand-authors
 * the two "LLM scoring pass" objects (the only thing Gemini would normally
 * produce) and feeds them through the exact same real application code the
 * live API routes use: runWritingPreChecks, combineDoublePass,
 * applyWordCountPenalty, applyCalibrationCeiling, combineTaskBand, and
 * persistWritingEvaluation/persistSpeakingEvaluation. Every guardrail, the
 * band-combination math, the official rounding, the evaluatorVersion
 * stamping, and the progress-table rollup are all genuinely exercised —
 * only the qualitative "what would Gemini have said" content is synthetic.
 *
 * Usage: npx tsx scripts/seedProgressDemo.ts
 */
import "dotenv/config";
import { prisma } from "../lib/db";
import { resolveUserId } from "../lib/demoUser";
import { combineDoublePass } from "../lib/scoring/doublePass";
import type { WritingEvaluationOutcome, CriterionOutcome } from "../lib/scoring/evaluateWriting";
import type { SpeakingEvaluationOutcome, SpeakingCriterionOutcome } from "../lib/scoring/evaluateSpeaking";
import {
  applyCalibrationCeiling,
  applyWordCountPenalty,
  MIN_TASK1_WORD_COUNT,
  MIN_TASK2_WORD_COUNT,
  runWritingPreChecks,
  type ScoredCriterionId,
} from "../lib/scoring/guardrails";
import { combineTaskBand } from "../lib/scoring/taskBand";
import { persistWritingEvaluation } from "../lib/scoring/persistWritingEvaluation";
import { persistSpeakingEvaluation } from "../lib/scoring/persistSpeakingEvaluation";
import type { WritingEvaluation } from "../lib/gemini/schemas/writingEvaluation";
import type { SpeakingEvaluation } from "../lib/gemini/schemas/speakingEvaluation";

const TASK2_PROMPT =
  "Some people think that technology has made our lives more complicated, while others believe it has made everyday life simpler. Discuss both views and give your own opinion.";
const TASK1_ACADEMIC_PROMPT =
  "The chart below shows the percentage of households with internet access in three countries between 2000 and 2020. Summarise the information by selecting and reporting the main features, and make comparisons where relevant.";

const TASK2_ESSAY_FULL = `Technology has undoubtedly reshaped nearly every part of modern life, and opinions are divided over whether this change has made daily routines more complicated or considerably easier. This essay will discuss both perspectives before presenting my own view.

On one hand, there is a strong case that technology has added complexity to everyday tasks. Many people now have to manage a growing number of devices, passwords, and software updates just to complete basic activities such as paying a bill or booking an appointment. Older generations in particular often find themselves overwhelmed by the pace at which digital tools change, and the constant need to learn new interfaces can feel like an additional burden rather than a convenience. Furthermore, the sheer volume of notifications and messages that smartphones generate can make it harder, not easier, to focus on a single task.

On the other hand, technology has clearly simplified many aspects of daily life. Tasks that once required significant time and effort, such as transferring money, finding directions, or communicating with someone overseas, can now be completed in seconds from a single device. Online shopping, video calls, and cloud-based document sharing have removed many of the practical obstacles that used to slow people down, allowing individuals to accomplish more with less friction.

In my opinion, while technology can feel overwhelming at first, its long-term effect is to simplify life once people become comfortable with it. The initial learning curve should not be mistaken for permanent complexity; rather, it is a temporary cost that is repaid many times over through the convenience these tools ultimately provide.

In conclusion, although new technology can initially seem to complicate daily routines, I believe its overall effect is to make life considerably simpler once it is properly understood and adopted.`;

const TASK2_ESSAY_SHORT = `Technology has changed daily life a lot. Some people think it makes things harder because there are so many devices and passwords to remember. Other people think it makes life easier because you can do things like banking or shopping from your phone in seconds.

I think technology mostly makes life easier once you learn how to use it. At first it can be confusing, but after that it saves a lot of time.

In conclusion, technology can be complicated at first but it makes life simpler overall.`;

const TASK1_ESSAY = `The chart illustrates how internet access among households changed in three countries from 2000 to 2020.

Overall, all three countries saw a substantial rise in household internet access over the period, although the starting points and rates of growth differed considerably.

In 2000, access was low across the board, with the wealthiest of the three countries starting at around 20%, while the other two began below 10%. Over the following two decades, however, all three showed steady and, in some cases, dramatic increases. By 2020, the leading country had reached close to universal access, exceeding 95%, while the other two had also made significant progress, reaching approximately 80% and 65% respectively.

The most rapid growth occurred between 2005 and 2015 for two of the three countries, a period that likely reflects the wider global expansion of broadband infrastructure. The third country grew more gradually but consistently throughout the entire twenty-year span.

Overall, the data shows a clear global trend towards near-universal internet access, even though the pace of adoption varied noticeably between the three countries shown.`;

const PART1_TOPIC = "hometowns";
const PART1_QUESTIONS = [
  "Where is your hometown?",
  "What do you like most about your hometown?",
  "Has your hometown changed much since you were a child?",
  "Would you like to live there in the future?",
];
const PART1_TRANSCRIPT =
  "My hometown is a mid-sized city about two hours from the capital. I really like it because it's quiet but still has everything you need, like good markets and parks. It has changed a lot actually, there are way more buildings now than when I was a kid, and traffic is definitely worse. I'd probably like to live there again eventually, maybe once I've finished studying, because it's close to my family and it's a comfortable place to settle down.";

const PART2_TOPIC = "a skill you learned";
const PART2_CUE_CARD = "Describe a skill you learned that you found useful.";
const PART2_BULLETS = [
  "what the skill is",
  "how you learned it",
  "how long it took to learn",
  "and explain why you found it useful",
];
const PART2_FINAL_PROMPT = "and explain why you found it useful.";
const PART2_TRANSCRIPT =
  "So, a skill I learned that turned out to be really useful is basic cooking. I picked it up mostly during university when I was living away from home for the first time, and honestly it started out of necessity because eating out every day was too expensive. I watched a lot of videos online and just practiced, sort of trial and error, burning a few things along the way. It probably took me, I'd say, about six months before I felt properly confident, like I could actually plan a meal instead of just following a recipe exactly. It's useful because, well, it saves money obviously, but also it's become kind of relaxing for me, a way to switch off after a busy day, and I can cook for friends now which is a nice thing to be able to do.";

function roundHalf(value: number): number {
  return Math.min(9, Math.max(2, Math.round(value * 2) / 2));
}

function buildFakeWritingPass(bands: {
  primary: number;
  cc: number;
  lr: number;
  gra: number;
}): WritingEvaluation {
  return {
    task_response: {
      band: bands.primary,
      evidence: ["This essay will discuss both perspectives before presenting my own view."],
      why: "Addresses all parts of the task with a clear position, supported by relevant ideas.",
    },
    coherence_cohesion: {
      band: bands.cc,
      evidence: ["On one hand ... On the other hand ... In my opinion ..."],
      why: "Logically organised with clear paragraphing and a range of cohesive devices.",
    },
    lexical_resource: {
      band: bands.lr,
      evidence: ["a growing number of devices, passwords, and software updates"],
      why: "Uses a reasonable range of vocabulary with some flexibility and precision.",
    },
    grammatical_range_accuracy: {
      band: bands.gra,
      evidence: ["although new technology can initially seem to complicate daily routines"],
      why: "A mix of simple and complex sentence structures with generally good control.",
    },
    inline_errors: [],
    next_band_actions: [
      "Develop your supporting ideas with more specific, real-world examples.",
      "Use a wider range of cohesive devices beyond basic linking words.",
      "Vary sentence structures further to reduce repetition of common patterns.",
    ],
    estimated_task_band: bands.primary,
  };
}

function buildWritingOutcome(params: {
  taskKind: "task1_academic" | "task2";
  questionPrompt: string;
  essayText: string;
  primary: number;
  cc: number;
  lr: number;
  gra: number;
}): WritingEvaluationOutcome {
  const primaryCriterion = params.taskKind === "task2" ? "TR" : "TA";
  const minWordCount = params.taskKind === "task2" ? MIN_TASK2_WORD_COUNT : MIN_TASK1_WORD_COUNT;
  const preCheck = runWritingPreChecks(params.questionPrompt, params.essayText, minWordCount);
  if (preCheck.isEmpty || preCheck.isGibberish) {
    throw new Error("Seed essay failed pre-checks — fix the seed text.");
  }

  const passInput = { primary: params.primary, cc: params.cc, lr: params.lr, gra: params.gra };
  const doublePass = combineDoublePass(buildFakeWritingPass(passInput), buildFakeWritingPass(passInput));

  const CRITERION_KEY_MAP = {
    TR: "task_response",
    TA: "task_response",
    CC: "coherence_cohesion",
    LR: "lexical_resource",
    GRA: "grammatical_range_accuracy",
  } as const;

  const criteria = {} as Record<ScoredCriterionId, CriterionOutcome>;
  const criterionIds: ScoredCriterionId[] = [primaryCriterion, "CC", "LR", "GRA"];
  for (const criterionId of criterionIds) {
    const key = CRITERION_KEY_MAP[criterionId];
    const rawBand = doublePass.canonicalBands[key];
    let finalBand = rawBand;
    let wordCountPenaltyApplied = false;
    if (criterionId === primaryCriterion) {
      const penalty = applyWordCountPenalty(rawBand, preCheck.meetsMinWordCount);
      finalBand = penalty.band;
      wordCountPenaltyApplied = penalty.applied;
    }
    const ceiling = applyCalibrationCeiling(criterionId, finalBand);
    finalBand = ceiling.band;
    criteria[criterionId] = {
      criterion: criterionId,
      rawBand,
      finalBand,
      wordCountPenaltyApplied,
      calibrationClamped: ceiling.clamped,
    };
  }

  const { unrounded, band } = combineTaskBand(
    criteria[primaryCriterion].finalBand,
    criteria.CC.finalBand,
    criteria.LR.finalBand,
    criteria.GRA.finalBand,
  );

  return {
    shortCircuited: false,
    preCheck,
    pass1: doublePass.pass1,
    pass2: doublePass.pass2,
    criteria,
    disagreementFlagged: doublePass.disagreementFlagged,
    unroundedTaskBand: unrounded,
    taskBand: band,
    modelSelfEstimatedBand:
      (doublePass.pass1.estimated_task_band + doublePass.pass2.estimated_task_band) / 2,
    primaryCriterion,
  };
}

function buildFakeSpeakingPass(bands: {
  fc: number;
  lr: number;
  gra: number;
  pr: number;
}): SpeakingEvaluation {
  return {
    fluency_coherence: {
      band: bands.fc,
      evidence: ["it started out of necessity because eating out every day was too expensive"],
      why: "Maintains flow with only occasional hesitation and some self-correction.",
    },
    lexical_resource: {
      band: bands.lr,
      evidence: ["trial and error, burning a few things along the way"],
      why: "Uses topic-specific vocabulary with some flexibility, though occasionally imprecise.",
    },
    grammatical_range_accuracy: {
      band: bands.gra,
      evidence: ["it probably took me, I'd say, about six months before I felt properly confident"],
      why: "A mix of simple and complex structures; errors rarely impede communication.",
    },
    pronunciation: {
      band: bands.pr,
      evidence: ["generally clear delivery across the response"],
      why: "Individual sounds are mostly clear, though rhythm and stress affect intelligibility at times.",
    },
    upgrade_phrases: [
      { original: "really useful", upgraded: "genuinely invaluable", reason: "More precise, less generic vocabulary." },
      { original: "a lot of", upgraded: "a considerable amount of", reason: "More natural at higher bands." },
      { original: "kind of relaxing", upgraded: "quite therapeutic", reason: "More idiomatic phrasing." },
    ],
    estimated_overall_band: roundHalf((bands.fc + bands.lr + bands.gra + bands.pr) / 4),
  };
}

function buildSpeakingOutcome(bands: {
  fc: number;
  lr: number;
  gra: number;
  pr: number;
}): SpeakingEvaluationOutcome {
  const doublePass = combineDoublePassForSpeaking(bands);
  const criteria: Record<"FC" | "LR" | "GRA" | "PR", SpeakingCriterionOutcome> = {
    FC: { criterion: "FC", band: bands.fc, evidence: doublePass.pass1.fluency_coherence.evidence, why: doublePass.pass1.fluency_coherence.why },
    LR: { criterion: "LR", band: bands.lr, evidence: doublePass.pass1.lexical_resource.evidence, why: doublePass.pass1.lexical_resource.why },
    GRA: { criterion: "GRA", band: bands.gra, evidence: doublePass.pass1.grammatical_range_accuracy.evidence, why: doublePass.pass1.grammatical_range_accuracy.why },
    PR: { criterion: "PR", band: bands.pr, evidence: doublePass.pass1.pronunciation.evidence, why: doublePass.pass1.pronunciation.why },
  };
  const { unrounded, band } = combineTaskBand(bands.fc, bands.lr, bands.gra, bands.pr);
  return {
    criteria,
    upgradePhrases: doublePass.pass1.upgrade_phrases,
    disagreementFlagged: false,
    unroundedOverallBand: unrounded,
    overallBand: band,
    modelSelfEstimatedBand: doublePass.pass1.estimated_overall_band,
    pronunciationSource: "ESTIMATED",
    acousticFeatures: { part1: null, part2: null, part3: null },
    pass1: doublePass.pass1,
    pass2: doublePass.pass2,
  };
}

/** No disagreement-combination helper exists for Speaking (see speakingDoublePass.ts, which calls Gemini) — identical passes here means zero disagreement, matching a stable temp-0 outcome. */
function combineDoublePassForSpeaking(bands: { fc: number; lr: number; gra: number; pr: number }) {
  const pass1 = buildFakeSpeakingPass(bands);
  const pass2 = buildFakeSpeakingPass(bands);
  return { pass1, pass2 };
}

interface WritingAttemptPlan {
  daysAgo: number;
  taskKind: "task1_academic" | "task2";
  primary: number;
  cc: number;
  lr: number;
  gra: number;
  short?: boolean;
}
interface SpeakingAttemptPlan {
  daysAgo: number;
  part: "part1" | "part2";
  fc: number;
  lr: number;
  gra: number;
  pr: number;
}

function buildSchedule(): { writing: WritingAttemptPlan[]; speaking: SpeakingAttemptPlan[] } {
  const writing: WritingAttemptPlan[] = [];
  const speaking: SpeakingAttemptPlan[] = [];

  // 18 days of history, practicing (almost) every day, trending upward with
  // realistic noise. GRA/PR are intentionally kept ~0.5-1 band behind the
  // other criteria so the weakness heatmap and weakness drill have a clear,
  // consistent target instead of a coin-flip winner.
  for (let daysAgo = 17; daysAgo >= 0; daysAgo--) {
    const progress = (17 - daysAgo) / 17; // 0 -> 1 across the window
    const base = 5.5 + progress * 2.0;
    const noise = Math.sin(daysAgo * 1.7) * 0.25;
    const overall = base + noise;

    const isWritingDay = daysAgo % 2 === 0;
    if (isWritingDay) {
      const taskKind: "task1_academic" | "task2" = daysAgo % 4 === 0 ? "task1_academic" : "task2";
      writing.push({
        daysAgo,
        taskKind,
        primary: roundHalf(overall + 0.2),
        cc: roundHalf(overall + 0.1),
        lr: roundHalf(overall),
        gra: roundHalf(overall - 0.5),
        short: daysAgo === 15, // demonstrate the word-count penalty guardrail once
      });
    } else {
      const part: "part1" | "part2" = daysAgo % 3 === 0 ? "part1" : "part2";
      speaking.push({
        daysAgo,
        part,
        fc: roundHalf(overall + 0.1),
        lr: roundHalf(overall - 0.2),
        gra: roundHalf(overall - 0.4),
        pr: roundHalf(overall - 1.0),
      });
    }
  }

  return { writing, speaking };
}

function daysAgoToDate(daysAgo: number): Date {
  const now = new Date();
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  d.setUTCDate(d.getUTCDate() - daysAgo);
  d.setUTCHours(14, 30, 0, 0); // a plausible mid-afternoon practice time
  return d;
}

async function seedWritingAttempt(userId: string, plan: WritingAttemptPlan): Promise<void> {
  const isTask2 = plan.taskKind === "task2";
  const question = await prisma.question.create({
    data: {
      module: "WRITING",
      taskType: isTask2 ? "WRITING_TASK2" : "WRITING_TASK1_ACADEMIC",
      testType: "ACADEMIC",
      difficulty: "MEDIUM",
      prompt: isTask2 ? TASK2_PROMPT : TASK1_ACADEMIC_PROMPT,
      instructions: isTask2
        ? "You should spend about 40 minutes on this task and write at least 250 words."
        : "You should spend about 20 minutes on this task and write at least 150 words.",
      topic: isTask2 ? "technology" : "internet access",
      expectedWordCount: isTask2 ? 250 : 150,
      source: "SEED",
      requestedByUserId: userId,
      dedupeHash: `seed-${plan.taskKind}-${plan.daysAgo}`,
    },
  });

  const essayText = isTask2
    ? plan.short
      ? TASK2_ESSAY_SHORT
      : TASK2_ESSAY_FULL
    : TASK1_ESSAY;

  const outcome = buildWritingOutcome({
    taskKind: plan.taskKind,
    questionPrompt: question.prompt,
    essayText,
    primary: plan.primary,
    cc: plan.cc,
    lr: plan.lr,
    gra: plan.gra,
  });

  const createdAt = daysAgoToDate(plan.daysAgo);
  await persistWritingEvaluation(outcome, {
    userId,
    questionId: question.id,
    answerText: essayText,
    timeSpentSeconds: isTask2 ? 38 * 60 + Math.round(Math.random() * 240) : 18 * 60 + Math.round(Math.random() * 180),
    createdAt,
  });
}

async function seedSpeakingAttempt(userId: string, plan: SpeakingAttemptPlan): Promise<void> {
  const isPart2 = plan.part === "part2";
  const question = await prisma.question.create({
    data: {
      module: "SPEAKING",
      taskType: isPart2 ? "SPEAKING_PART2" : "SPEAKING_PART1",
      difficulty: "MEDIUM",
      prompt: isPart2 ? PART2_CUE_CARD : PART1_QUESTIONS.join(" "),
      instructions: isPart2
        ? "You have 1 minute to prepare, then speak for 1-2 minutes."
        : "Answer each question naturally and briefly, as in a conversation.",
      topic: isPart2 ? PART2_TOPIC : PART1_TOPIC,
      part1Topics: isPart2 ? undefined : [{ topic: PART1_TOPIC, questions: PART1_QUESTIONS }],
      cueCardPoints: isPart2 ? { bulletPoints: PART2_BULLETS, finalPrompt: PART2_FINAL_PROMPT } : undefined,
      prepSeconds: isPart2 ? 60 : undefined,
      speakingSeconds: isPart2 ? 120 : undefined,
      source: "SEED",
      requestedByUserId: userId,
      dedupeHash: `seed-speaking-${plan.part}-${plan.daysAgo}`,
    },
  });

  const transcript = isPart2 ? PART2_TRANSCRIPT : PART1_TRANSCRIPT;
  const createdAt = daysAgoToDate(plan.daysAgo);
  const durationSeconds = isPart2 ? 105 : 65;

  const submission = await prisma.submission.create({
    data: {
      userId,
      questionId: question.id,
      module: "SPEAKING",
      status: "PENDING",
      transcript,
      durationSeconds,
      timeSpentSeconds: durationSeconds,
      createdAt,
    },
  });

  const outcome = buildSpeakingOutcome({ fc: plan.fc, lr: plan.lr, gra: plan.gra, pr: plan.pr });
  await persistSpeakingEvaluation(outcome, { canonicalSubmissionId: submission.id, userId });
}

async function main() {
  const userId = await resolveUserId();
  console.log(`Seeding progress demo history for user ${userId}...`);

  const { writing, speaking } = buildSchedule();

  for (const plan of writing) {
    await seedWritingAttempt(userId, plan);
  }
  for (const plan of speaking) {
    await seedSpeakingAttempt(userId, plan);
  }

  const progressRows = await prisma.progress.findMany({ where: { userId }, orderBy: { date: "asc" } });
  console.log(`Done. Seeded ${writing.length} Writing + ${speaking.length} Speaking attempts.`);
  console.log(`Progress table now has ${progressRows.length} day-rows for this user:`);
  for (const row of progressRows) {
    console.log(
      `  ${row.date.toISOString().slice(0, 10)}  ${row.module.padEnd(8)}  avgOverall=${row.avgOverall ?? "—"}  submissions=${row.submissionsCount}`,
    );
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
