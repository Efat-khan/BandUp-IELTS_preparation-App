/**
 * IELTS Writing Task 1 band descriptor knowledge base (Academic + General
 * Training). Paraphrased from the publicly published official IELTS
 * Writing Task 1 band descriptor tables — Task Achievement (Academic:
 * accurate data reporting; General: letter purpose/tone/coverage),
 * Coherence & Cohesion, Lexical Resource, Grammatical Range & Accuracy.
 *
 * Same caveat as writingTask2.ts: this is a from-knowledge reconstruction,
 * not a copy of BandUp_Documentation.md (not present in this repo). Swap
 * in the exact spec text if it differs.
 */

export type WritingTask1CriterionId = "TA" | "CC" | "LR" | "GRA";

export const WRITING_TASK1_CRITERION_NAMES: Record<WritingTask1CriterionId, string> = {
  TA: "Task Achievement",
  CC: "Coherence and Cohesion",
  LR: "Lexical Resource",
  GRA: "Grammatical Range and Accuracy",
};

export type Task1BandDescriptorTable = Partial<Record<9 | 8 | 7 | 6 | 5 | 4 | 3 | 2 | 1, string>>;

/** Academic Task 1: reporting/comparing data from a chart, table, process, or map. */
export const WRITING_TASK1_ACADEMIC_TA_DESCRIPTORS: Task1BandDescriptorTable = {
  9: "Fully satisfies all requirements; presents a fully developed, accurate overview of the key trends/differences/stages; covers and highlights all key features precisely with no unsupported detail.",
  8: "Covers all requirements sufficiently; presents a clear, accurate, and well-developed overview; key features are appropriately selected and precisely reported, with minor lapses in data accuracy at most.",
  7: "Covers the requirements of the task; presents a clear overview of main trends, differences, or stages; clearly highlights and reports key features, though there may be a tendency to focus on minor detail or the overview may be less than fully developed.",
  6: "Addresses the requirements of the task and covers the key features, though some may be inadequately covered while others receive more attention than necessary; a clear overview is attempted but may be incomplete, imprecise, or inaccurate in places; presents data with generally accurate but occasionally imprecise reporting.",
  5: "Generally addresses the task; the format may be inappropriate in places; an overview may be attempted but is limited or unclear; key features are recognisable but may be missing, irrelevant, repetitive, or inaccurate; there may be a tendency to focus on details without an overview.",
  4: "Attempts to address the task but does not cover all key features; may confuse features with detail; no clear overview; data may be inaccurately or inadequately reported; mechanical repetition of the input data may occur.",
  3: "Fails to address the requirements of the task; may misunderstand the data or the task type entirely; contains limited or irrelevant detail.",
  2: "Barely responds to the task; content is barely related to the input data.",
  1: "Content is barely related to the task.",
};

/** General Training Task 1: a letter with a clear purpose, tone, and set of required points. */
export const WRITING_TASK1_GENERAL_TA_DESCRIPTORS: Task1BandDescriptorTable = {
  9: "Fully satisfies all requirements of the task; skilfully and precisely achieves the letter's purpose; consistently uses a tone and register appropriate to the recipient and situation throughout.",
  8: "Covers all requirements sufficiently; the purpose is very clearly established and maintained; tone and register are appropriate throughout, with only occasional inconsistency.",
  7: "Covers the requirements of the task; the purpose is clear; uses a generally appropriate tone and register, though there may be occasional lapses in consistency.",
  6: "Addresses the requirements of the task; the purpose is generally clear, though the tone/register may be inconsistent or not fully appropriate in places; all bullet points are covered but some may be under-developed.",
  5: "Generally addresses the task; the format may be inappropriate in places; the purpose is not always clear; tone may be inconsistent with the required register; may omit or under-develop one required point.",
  4: "Attempts to address the task but the purpose is unclear or inconsistently maintained; tone/register is often inappropriate; one or more required points may be missing.",
  3: "Fails to address the requirements of the task; the purpose is barely discernible; omits multiple required points.",
  2: "Barely responds to the task; content is barely related to the required purpose.",
  1: "Content is barely related to the task.",
};

/** Coherence & Cohesion, Lexical Resource, Grammatical Range & Accuracy — shared wording across Academic/General Task 1. */
export const WRITING_TASK1_SHARED_DESCRIPTORS: Record<"CC" | "LR" | "GRA", Task1BandDescriptorTable> = {
  CC: {
    9: "Cohesion is used in such a way that it attracts no attention; skilfully manages paragraphing.",
    8: "Sequences information and ideas logically; manages all aspects of cohesion well; uses paragraphing sufficiently and appropriately.",
    7: "Logically organises information and ideas; there is clear progression throughout the report/letter; uses a range of cohesive devices appropriately, though there may be some under/over-use.",
    6: "Arranges information coherently and there is a clear overall progression; uses cohesive devices effectively, but cohesion within/between sentences may be faulty or mechanical; paragraphing is used but not always logically.",
    5: "Presents information with some organisation but there may be a lack of overall progression; makes inadequate, inaccurate, or overused cohesive devices; paragraphing may be inadequate or missing.",
    4: "Presents information but this is not arranged coherently and there is no clear progression; uses only basic cohesive devices, which may be inaccurate or repetitive; paragraphing may be absent or inadequate.",
    3: "Does not organise information logically; cohesive devices used, if any, do not indicate a logical relationship between ideas.",
    2: "Has very little control of organisational features.",
    1: "Fails to communicate any message.",
  },
  LR: {
    9: "Uses a wide range of vocabulary, including precise terminology for describing data/trends or the letter's context, with very natural and sophisticated control; rare minor errors occur only as slips.",
    8: "Uses a wide range of vocabulary fluently and flexibly to convey precise meanings; skilfully uses less common lexical items but there may be occasional inaccuracies; rare errors in spelling/word formation.",
    7: "Uses a sufficient range of vocabulary to allow some flexibility and precision, including some less common items; may produce occasional errors in word choice, spelling, and/or word formation.",
    6: "Uses an adequate range of vocabulary for the task; attempts less common vocabulary with some inaccuracy; makes some errors in spelling/word formation that do not impede communication.",
    5: "Uses a limited range of vocabulary that is minimally adequate for the task; noticeable errors in spelling/word formation may cause some difficulty for the reader.",
    4: "Uses only basic vocabulary which may be repetitive or inappropriate for the task; limited control of word formation/spelling; errors may cause strain for the reader.",
    3: "Uses only a very limited range of words and expressions with very limited control of word formation/spelling.",
    2: "Has an extremely limited vocabulary; essentially no control of word formation/spelling.",
    1: "Can only use a few isolated words.",
  },
  GRA: {
    9: "Uses a wide range of structures with full flexibility and accuracy; rare minor errors occur only as slips.",
    8: "Uses a wide range of structures; the majority of sentences are error-free; makes only very occasional errors or inappropriacies.",
    7: "Uses a variety of complex structures; produces frequent error-free sentences; has good control of grammar and punctuation but may make a few errors.",
    6: "Uses a mix of simple and complex sentence forms; makes some errors in grammar and punctuation but they rarely reduce communication.",
    5: "Uses only a limited range of structures; attempts complex sentences but these tend to be less accurate; may make frequent grammatical errors and punctuation may be faulty.",
    4: "Uses only a very limited range of structures with rare use of subordinate clauses; some structures are accurate but errors predominate, and punctuation is often faulty.",
    3: "Attempts sentence forms but errors in grammar and punctuation predominate and distort meaning.",
    2: "Cannot use sentence forms except in memorised phrases.",
    1: "Cannot use sentence forms at all.",
  },
};

export function getWritingTask1Descriptors(
  testType: "academic" | "general",
): Record<WritingTask1CriterionId, Task1BandDescriptorTable> {
  return {
    TA:
      testType === "academic"
        ? WRITING_TASK1_ACADEMIC_TA_DESCRIPTORS
        : WRITING_TASK1_GENERAL_TA_DESCRIPTORS,
    ...WRITING_TASK1_SHARED_DESCRIPTORS,
  };
}
