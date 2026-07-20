/**
 * IELTS Writing Task 2 band descriptor knowledge base.
 *
 * Paraphrased from the publicly published official IELTS Writing Task 2
 * band descriptor tables (Task Response, Coherence & Cohesion, Lexical
 * Resource, Grammatical Range & Accuracy — bands 1-9). This is the
 * authoritative reference injected into every scoring system prompt so
 * the evaluator scores against the real published criteria rather than
 * from instinct (non-negotiable rule #1).
 *
 * NOTE: this is a from-knowledge reconstruction, not a copy-paste of
 * BandUp_Documentation.md §9/§10 (that file is not present in this repo).
 * Swap in the exact spec text if it differs.
 */

export type WritingCriterionId = "TR" | "CC" | "LR" | "GRA";

export const WRITING_CRITERION_NAMES: Record<WritingCriterionId, string> = {
  TR: "Task Response",
  CC: "Coherence and Cohesion",
  LR: "Lexical Resource",
  GRA: "Grammatical Range and Accuracy",
};

/** Descriptor text for a single whole band, 1-9 (9 is defined; 1 covers <=1). */
export type BandDescriptorTable = Partial<Record<9 | 8 | 7 | 6 | 5 | 4 | 3 | 2 | 1, string>>;

export const WRITING_TASK2_DESCRIPTORS: Record<WritingCriterionId, BandDescriptorTable> = {
  TR: {
    9: "Fully addresses all parts of the task with a fully developed position; ideas are relevant, extended, and well supported, with no over-generalisation.",
    8: "Sufficiently addresses all parts of the task; presents a well-developed response with relevant, extended, and supported ideas; the position is clear throughout, with only occasional lapses in focus.",
    7: "Addresses all parts of the task, though some parts may be more fully covered than others; presents a clear overall position with main ideas extended and supported, though some may be over-generalised or lack focus.",
    6: "Addresses all parts of the task, but some parts are covered more adequately than others; presents a relevant position, though conclusions may be unclear or repetitive; main ideas are relevant but may be under-developed, unclear, or insufficiently supported.",
    5: "Addresses the task only partially; the format may be inappropriate in places; presents a position, but development is not always clear and there may be little support for ideas; may confuse task with a related but different one.",
    4: "Responds to the task only in a minimal way, or the answer is tangential; the position may be unclear or repeated without development; some main points are given but very few are supported and irrelevant detail may be present.",
    3: "Does not adequately address any part of the task; barely presents a position; minimal or no relevant support for ideas presented.",
    2: "Barely responds to the task; may only be loosely related to the topic.",
    1: "Content is barely related to the task.",
  },
  CC: {
    9: "Cohesion is used in such a way that it attracts no attention; skilfully manages paragraphing.",
    8: "Sequences information and ideas logically; manages all aspects of cohesion well; uses paragraphing sufficiently and appropriately.",
    7: "Logically organises information and ideas; there is clear progression throughout; uses a range of cohesive devices appropriately, though there may be some under/over-use; presents a clear central topic in each paragraph.",
    6: "Arranges information and ideas coherently and there is a clear overall progression; uses cohesive devices effectively, but cohesion within/between sentences may be faulty or mechanical; may not always use referencing clearly or appropriately; uses paragraphing, but not always logically.",
    5: "Presents information with some organisation but there may be a lack of overall progression; makes inadequate, inaccurate, or overuse of cohesive devices; may be repetitive due to inadequate/inaccurate use of reference and substitution; paragraphing may be inadequate or missing.",
    4: "Presents information and ideas but these are not arranged coherently and there is no clear progression in the response; uses some basic cohesive devices, which may be inaccurate or repetitive; may not write in paragraphs, or paragraphing may be inadequate.",
    3: "Does not organise ideas logically; may use a very limited range of cohesive devices, and those used may not indicate a logical relationship between ideas.",
    2: "Has very little control of organisational features.",
    1: "Fails to communicate any message; response may be memorised and bears little relation to the task.",
  },
  LR: {
    9: "Uses a wide range of vocabulary with very natural and sophisticated control of lexical features; rare minor errors occur only as slips.",
    8: "Uses a wide range of vocabulary fluently and flexibly to convey precise meanings; skilfully uses uncommon lexical items but there may be occasional inaccuracies in word choice and collocation; produces rare errors in spelling and/or word formation.",
    7: "Uses a sufficient range of vocabulary to allow some flexibility and precision; uses less common lexical items with some awareness of style and collocation; may produce occasional errors in word choice, spelling and/or word formation.",
    6: "Uses an adequate range of vocabulary for the task; attempts to use less common vocabulary but with some inaccuracy; makes some errors in spelling and/or word formation, but they do not impede communication.",
    5: "Uses a limited range of vocabulary, but this is minimally adequate for the task; may make noticeable errors in spelling and/or word formation that may cause some difficulty for the reader.",
    4: "Uses only basic vocabulary, which may be used repetitively or which may be inappropriate for the task; has limited control of word formation and/or spelling; errors may cause strain for the reader.",
    3: "Uses only a very limited range of words and expressions with very limited control of word formation and/or spelling; errors may severely distort the message.",
    2: "Has an extremely limited vocabulary; essentially no control of word formation and/or spelling.",
    1: "Can only use a few isolated words.",
  },
  GRA: {
    9: "Uses a wide range of structures with full flexibility and accuracy; rare minor errors occur only as slips.",
    8: "Uses a wide range of structures; the majority of sentences are error-free; makes only very occasional errors or inappropriacies.",
    7: "Uses a variety of complex structures; produces frequent error-free sentences; has good control of grammar and punctuation but may make a few errors.",
    6: "Uses a mix of simple and complex sentence forms; makes some errors in grammar and punctuation but they rarely reduce communication.",
    5: "Uses only a limited range of structures; attempts complex sentences but these tend to be less accurate than simple sentences; may make frequent grammatical errors and punctuation may be faulty; errors can cause some difficulty for the reader.",
    4: "Uses only a very limited range of structures with only rare use of subordinate clauses; some structures are accurate but errors predominate, and punctuation is often faulty.",
    3: "Attempts sentence forms but errors in grammar and punctuation predominate and distort meaning.",
    2: "Cannot use sentence forms except in memorised phrases.",
    1: "Cannot use sentence forms at all.",
  },
};

/**
 * Short illustrative anchor snippets per whole band — NOT verified official
 * sample answers (the real gold-standard calibration set lives in
 * /calibration and is what scripts/calibrate.ts measures against). These
 * exist purely to give the evaluator a stylistic sense of register at each
 * band; they should not be treated as ground truth.
 */
export const WRITING_TASK2_CALIBRATION_ANCHORS: Partial<Record<9 | 8 | 7 | 6 | 5 | 4, string>> = {
  9: "The argument is developed with precision: 'While proponents contend that automation displaces low-skill labour wholesale, this overlooks the compensatory demand generated in adjacent service sectors — a pattern borne out historically by the transition away from agrarian economies.'",
  8: "Ideas are extended fluently: 'Although automation undeniably displaces certain roles, it simultaneously creates demand in maintenance, oversight and design — sectors that barely existed a generation ago.'",
  7: "Clear position with some over-generalisation: 'Automation will replace many jobs, but it also creates new ones in technology and engineering, so the overall effect on employment is not necessarily negative.'",
  6: "Relevant but under-developed: 'Some jobs will disappear because of automation. But new jobs will be created too. So it is hard to say if it is a bad thing overall.'",
  5: "Position present but poorly supported: 'Automation is a big problem for jobs. Many people will lose their jobs. But also it can help the economy in some way.'",
  4: "Minimal, tangential response: 'Automation is happening in many countries. It is used in factories and offices. Some people like it and some do not.'",
};

export function getWritingBandDescriptor(
  criterion: WritingCriterionId,
  wholeBand: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9,
): string | undefined {
  return WRITING_TASK2_DESCRIPTORS[criterion][wholeBand];
}
