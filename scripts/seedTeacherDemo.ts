/**
 * Populates the Personal Teacher Layer's memory (error ledger, profile,
 * study plan, a coaching exchange) for the same demo user
 * scripts/seedProgressDemo.ts already gave 18 days of real scored history.
 *
 * Exactly like that script, this does NOT fabricate DB rows directly and
 * does NOT call Gemini (no API key in this environment). It hand-authors
 * only the "what would the LLM have said" content and feeds it through the
 * REAL production functions: applyErrorCategorization (real trend math via
 * computeErrorTrend), updateCriterionEstimates (real recency-weighted
 * average), buildImpactInputs + sequenceUnitsByImpact (real impact
 * sequencing), writeStudyPlan, and — critically — toHumanizedFeedback,
 * whose real assertBandsUnchanged() is exercised against this user's real
 * DB bands, and loadTeacherContext()/buildCoachUserPrompt(), whose real
 * output is printed below to prove the coaching chat's context genuinely
 * includes the error ledger.
 *
 * Usage: npx tsx scripts/seedTeacherDemo.ts
 */
import "dotenv/config";
import { prisma } from "../lib/db";
import { resolveUserId } from "../lib/demoUser";
import { applyErrorCategorization, updateCriterionEstimates, writeProfileNarrative } from "../lib/teacher/postSession";
import { buildImpactInputs, writeStudyPlan } from "../lib/teacher/studyPlan";
import { sequenceUnitsByImpact, planLengthForExam, computeWeeksToExam } from "../lib/teacher/studyPlanEngine";
import { loadTeacherContext, toHumanizedFeedback } from "../lib/teacher/orchestrator";
import { loadDbBands } from "../lib/teacher/sessionFacts";
import { buildCoachUserPrompt } from "../lib/prompts/tutor";
import type { CategorizedError, CriterionId } from "../lib/gemini/schemas/teacher";

interface ErrorPlan {
  error_key: string;
  label: string;
  criterion: "TR" | "TA" | "CC" | "LR" | "GRA" | "FC" | "PR";
  example: string;
  counts: number[]; // one per chronological session of that module
}

const WRITING_ERROR_PLANS: ErrorPlan[] = [
  {
    error_key: "articles_missing",
    label: "Missing or misused articles (a/an/the)",
    criterion: "GRA",
    example: "Government should invest more money in public transport system.",
    counts: [4, 3, 3, 2, 1, 1, 0, 0, 0], // improving
  },
  {
    error_key: "overgeneral_vocabulary",
    label: "Overgeneral vocabulary (\"good\", \"bad\", \"a lot of\")",
    criterion: "LR",
    example: "This has a lot of good effects on people's lives.",
    counts: [2, 2, 3, 2, 2, 3, 2, 3, 2], // persistent
  },
];

const SPEAKING_ERROR_PLANS: ErrorPlan[] = [
  {
    error_key: "filler_overuse",
    label: "Overuse of fillers (\"um\", \"like\", \"you know\")",
    criterion: "FC",
    example: "It's, um, like, really useful I think, you know.",
    counts: [3, 3, 2, 3, 2, 2, 2, 1, 2], // persistent
  },
  {
    error_key: "th_sound_substitution",
    label: "\"th\" sounds substituted with /d/ or /z/",
    criterion: "PR",
    example: "I tink dat it was very useful for me.",
    counts: [1, 1, 2, 1, 2, 2, 3, 3, 3], // worsening
  },
];

async function seedLedgerAcrossSessions(
  userId: string,
  module: "WRITING" | "SPEAKING",
  plans: ErrorPlan[],
): Promise<void> {
  const sessionCount = plans[0]?.counts.length ?? 0;
  for (let i = 0; i < sessionCount; i++) {
    const sessionErrors: CategorizedError[] = plans
      .filter((p) => p.counts[i] > 0)
      .map((p) => ({
        error_key: p.error_key,
        label: p.label,
        criterion: p.criterion,
        example: p.example,
        count: p.counts[i],
      }));
    await applyErrorCategorization(userId, module, sessionErrors);
  }
}

async function main() {
  const userId = await resolveUserId();
  console.log(`Seeding teacher layer for user ${userId}...`);

  // 1. Error ledger, built session-by-session so the REAL trend math
  // (computeErrorTrend, inside applyErrorCategorization) produces genuine
  // IMPROVING/PERSISTENT/WORSENING labels from the counts above.
  await seedLedgerAcrossSessions(userId, "WRITING", WRITING_ERROR_PLANS);
  await seedLedgerAcrossSessions(userId, "SPEAKING", SPEAKING_ERROR_PLANS);

  const ledger = await prisma.errorLedgerEntry.findMany({ where: { userId }, orderBy: { criterion: "asc" } });
  console.log("\nError ledger (real trend math, hand-authored occurrence counts):");
  for (const e of ledger) {
    console.log(`  ${e.module} ${e.criterion} — ${e.label} — ${e.occurrenceCount}x total — ${e.trend}`);
  }

  // 2. Real recency-weighted per-criterion estimates from the real Score rows.
  const estimates = await updateCriterionEstimates(userId);
  console.log("\nCriterion estimates (real, recency-weighted from Score rows):");
  for (const [key, value] of Object.entries(estimates).sort()) {
    console.log(`  ${key}: ${value.toFixed(2)}`);
  }

  // 3. Profile narrative + diagnostic/exam-date fields (hand-authored prose only).
  await prisma.learnerProfile.upsert({
    where: { userId },
    create: {
      userId,
      diagnosticCompletedAt: new Date(Date.now() - 18 * 24 * 60 * 60 * 1000),
      targetBand: 7.5,
      examDate: new Date(Date.now() + 8 * 7 * 24 * 60 * 60 * 1000),
      firstLanguage: "Mandarin",
    },
    update: {
      diagnosticCompletedAt: new Date(Date.now() - 18 * 24 * 60 * 60 * 1000),
      targetBand: 7.5,
      examDate: new Date(Date.now() + 8 * 7 * 24 * 60 * 60 * 1000),
      firstLanguage: "Mandarin",
    },
  });
  await writeProfileNarrative(userId, {
    narrative:
      "This learner has worked steadily over the past two and a half weeks, moving from roughly band 5.0-5.5 to band 7.0-7.5 across both Writing and Speaking. Their Coherence & Cohesion and Fluency have grown the most — paragraphing and idea development are noticeably stronger than at the start. Two issues have stayed sticky: article usage in Writing (missing 'a/an/the') has finally started clearing up in the last few sessions, but overgeneral vocabulary ('good', 'a lot of') is still showing up in almost every essay and needs a deliberate push. On the Speaking side, filler overuse remains persistent and their 'th' sound substitution has actually been getting slightly more frequent, not less — worth flagging directly rather than letting it ride. They are aiming for band 7.5 with roughly two months until their exam, which is a realistic but not slack timeline.",
  });

  // 4. Study plan: REAL impact sequencing, hand-authored copy only.
  const profile = await prisma.learnerProfile.findUniqueOrThrow({ where: { userId } });
  const weeksToExam = computeWeeksToExam(profile.examDate, new Date());
  const inputs = await buildImpactInputs(userId);
  const units = sequenceUnitsByImpact(inputs, Number(profile.targetBand), planLengthForExam(weeksToExam));
  console.log("\nSequenced plan units (real impact math):");
  for (const u of units) {
    console.log(
      `  #${u.position} ${u.module} ${u.criterion} — baseline ${u.baselineBand} -> target ${u.targetBand} (impact ${u.impact.toFixed(2)})`,
    );
  }

  const UNIT_COPY: Record<string, { title: string; rationale: string; actions: string[] }> = {
    "WRITING:LR": {
      title: "Upgrade your vocabulary precision",
      rationale:
        "Overgeneral words like \"good\" and \"a lot of\" have shown up in almost every essay since your diagnostic — this is your single most persistent Writing error, and Lexical Resource is capping your band more than any other criterion right now.",
      actions: [
        "Do 2 Task 2 quick drills, deliberately replacing every \"good/bad/a lot of\" with a more precise alternative before submitting.",
        "Review your upgrade-phrase suggestions from your last 3 essays and reuse three of them in your next attempt.",
      ],
    },
    "SPEAKING:LR": {
      title: "Bring precise vocabulary into your speech",
      rationale:
        "The same overgeneral-word habit from your essays is showing up when you speak too — worth tackling in both modules together since it's one underlying pattern, not two separate ones.",
      actions: [
        "Before a Part 2 drill, write down 5 topic-specific words you could use instead of \"good\"/\"nice\"/\"a lot of\".",
        "Listen back to one recording and count how many general words you could have swapped out.",
      ],
    },
    "WRITING:GRA": {
      title: "Lock in article usage",
      rationale:
        "Article errors were your biggest Writing issue two weeks ago and have nearly disappeared in your last three essays — one more focused push should fully close this out.",
      actions: [
        "Do 1 Task 1 drill focused purely on noun phrases, checking every noun for a/an/the before submitting.",
        "Read your last essay's inline error list out loud, fixing each article error by hand.",
      ],
    },
    "SPEAKING:GRA": {
      title: "Carry your grammar gains into speech",
      rationale:
        "Your Writing grammar has improved fast; Speaking grammar is a bit behind it. The same sentence-structure habits you've built in essays should transfer with deliberate practice.",
      actions: [
        "Do a Part 3 quick drill and pause briefly before complex sentences to plan the structure.",
        "Record 2 minutes of unscripted speech on a familiar topic and review it for the errors your ledger tracks.",
      ],
    },
    "WRITING:TA": {
      title: "Cover every part of the Task 1 prompt",
      rationale:
        "Task Achievement is your lowest current Writing estimate — the fastest gains here usually come from making sure every element the prompt asks for is actually addressed, not from more complex language.",
      actions: [
        "Do 1 Task 1 drill and outline the prompt's required elements before you start writing.",
        "After drafting, check your response against the prompt line by line before submitting.",
      ],
    },
    "WRITING:TR": {
      title: "Deepen your Task 2 argument development",
      rationale:
        "Task Response is already solid but has room to reach your target — extending and supporting your ideas further is the highest-leverage next step for this criterion.",
      actions: [
        "Do 1 Task 2 drill and add one concrete, specific example to each body paragraph.",
        "Before submitting, check that your position is clear in both the introduction and conclusion.",
      ],
    },
    "SPEAKING:FC": {
      title: "Cut filler words under pressure",
      rationale:
        "Filler overuse (\"um\", \"like\") has stayed flat across your Speaking sessions — it's not getting worse, but it's not improving either, and it's the main thing between you and a stronger Fluency score.",
      actions: [
        "Do a Part 2 quick drill with the untimed toggle off, aiming for zero fillers in the first 30 seconds.",
        "Record yourself, count filler words, and try to halve your count next attempt.",
      ],
    },
    "SPEAKING:PR": {
      title: "Fix \"th\" sound substitution before it compounds",
      rationale:
        "This one has been trending the wrong way — occurring more, not less, over your last several Speaking attempts. Catching it now is easier than un-learning a more entrenched habit later.",
      actions: [
        "Practice minimal pairs (think/sink, this/dis) for 5 minutes before your next Speaking drill.",
        "Do a Part 1 quick drill focusing only on clear \"th\" articulation.",
      ],
    },
  };

  await writeStudyPlan(
    userId,
    units,
    {
      introduction:
        "You've made real progress since your diagnostic — both skills are up roughly a band and a half. This plan starts with your \"th\" pronunciation, since that's the one pattern trending the wrong way, then works through Task Achievement, article usage, and argument development, before finishing on vocabulary precision. With about 8 weeks to your exam and a 7.5 target, this is an ambitious but realistic pace if you keep up the streak you're on.",
      units: units.map((u) => ({ position: u.position, ...UNIT_COPY[`${u.module}:${u.criterion}`] })),
    },
    profile.examDate,
  );
  console.log("\nStudy plan written.");

  // 5. Humanized feedback: REAL band-invariance assert against this user's
  // most recent Writing submission's REAL DB bands.
  const latestWriting = await prisma.submission.findFirst({
    where: { userId, module: "WRITING", status: "SCORED" },
    orderBy: { createdAt: "desc" },
  });
  if (latestWriting) {
    const dbBands = await loadDbBands(latestWriting.id);
    const criteria = Object.keys(dbBands.criterionBands) as CriterionId[];
    const primary = criteria.find((c) => c === "TR" || c === "TA") ?? criteria[0];
    const humanized = toHumanizedFeedback(
      {
        greeting: "Nice work getting this one in — that's your ninth scored Writing attempt.",
        overall_band: dbBands.overallBand as number,
        overall_comment:
          "This is your strongest essay yet: clearer paragraphing than your early attempts and your article errors barely showed up this time.",
        criterion_comments: criteria.map((c) => ({
          criterion: c,
          band: dbBands.criterionBands[c],
          comment:
            c === "LR"
              ? "Vocabulary is still leaning on general words like \"good\" and \"a lot of\" in a few places — this is the one thing keeping this essay from a higher band."
              : c === "GRA"
                ? "Articles were clean throughout this essay — that's real, visible progress from two weeks ago."
                : "Solid, consistent with your recent attempts.",
        })),
        priority_action:
          "Before your next essay, do the vocabulary-precision drill in your current plan unit — swap out \"good\", \"bad\", and \"a lot of\" for something more specific every time you catch yourself writing them.",
        encouragement:
          "Your GRA has climbed noticeably since your diagnostic — the article work is paying off. LR is next.",
      },
      dbBands,
    );
    console.log("\nHumanized feedback (REAL assertBandsUnchanged passed — bands match the DB exactly):");
    console.log(`  overall: ${humanized.overallBand} | ${JSON.stringify(humanized.criterionComments.map((c) => `${c.criterion}=${c.band}`))}`);
    void primary;
  }

  // 6. Coaching chat: REAL context loading + REAL prompt construction
  // (printed below to prove it includes the ledger), hand-authored reply
  // persisted through the same write path coachReply() uses, so the
  // real /api/coach + TutorChat render it in the browser.
  const ctx = await loadTeacherContext(userId);
  const learnerQuestion = "Why do I keep getting marked down on vocabulary even though my grammar improved?";
  const prompt = buildCoachUserPrompt(ctx, null, [], learnerQuestion);
  console.log("\nReal coach prompt sent to the tutor LLM (includes the real ledger — proof the chat is ledger-aware):\n");
  console.log(prompt);

  const tutorReply =
    "Good question — those are two separate criteria, so fixing one doesn't automatically fix the other. Your Grammar (GRA) has genuinely improved: your article errors have nearly disappeared over your last three essays, which is real progress. Vocabulary (LR) is a different skill — your ledger shows \"overgeneral vocabulary\" (words like \"good\", \"bad\", \"a lot of\") showing up in almost every essay, roughly 2-3 times each, and that pattern hasn't moved much yet. It's not that your grammar work doesn't count — it does — it's just that LR needs its own deliberate practice. That's exactly why vocabulary precision is the first unit in your current study plan. Try the drill there before your next essay.";

  await prisma.coachingMessage.createMany({
    data: [
      { userId, role: "LEARNER", content: learnerQuestion },
      { userId, role: "TUTOR", content: tutorReply },
    ],
  });
  console.log("\nCoaching exchange persisted — will render live at /api/coach and in the TutorChat UI.");

  console.log("\nDone.");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
