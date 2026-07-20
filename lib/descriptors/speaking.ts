/**
 * IELTS Speaking band descriptor knowledge base. Paraphrased from the
 * publicly published official IELTS Speaking band descriptor tables —
 * Fluency & Coherence, Lexical Resource, Grammatical Range & Accuracy,
 * Pronunciation — bands 1-9.
 *
 * Same caveat as the Writing descriptor files: this is a from-knowledge
 * reconstruction, not a copy of BandUp_Documentation.md (not present in
 * this repo). Swap in the exact spec text (§10.3) if it differs.
 */

export type SpeakingCriterionId = "FC" | "LR" | "GRA" | "PR";

export const SPEAKING_CRITERION_NAMES: Record<SpeakingCriterionId, string> = {
  FC: "Fluency and Coherence",
  LR: "Lexical Resource",
  GRA: "Grammatical Range and Accuracy",
  PR: "Pronunciation",
};

export type SpeakingBandDescriptorTable = Partial<Record<9 | 8 | 7 | 6 | 5 | 4 | 3 | 2 | 1, string>>;

export const SPEAKING_DESCRIPTORS: Record<SpeakingCriterionId, SpeakingBandDescriptorTable> = {
  FC: {
    9: "Speaks fluently with only rare repetition or self-correction; any hesitation is content-driven rather than to find words or grammar; speaks coherently with fully appropriate cohesive features; develops topics fully and appropriately.",
    8: "Speaks fluently with only occasional repetition or self-correction; hesitation is usually content-driven and only rarely to search for language; develops topics coherently and appropriately.",
    7: "Speaks at length without noticeable effort or loss of coherence; may demonstrate language-related hesitation at times, or some repetition and/or self-correction; uses a range of connectives and discourse markers with some flexibility.",
    6: "Is willing to speak at length, though may lose coherence at times due to occasional repetition, self-correction, or hesitation; uses a range of connectives and discourse markers but not always appropriately.",
    5: "Usually maintains flow of speech but uses repetition, self-correction, and/or slow speech to keep going; may over-use certain connectives/discourse markers; produces simple speech fluently but more complex communication causes fluency problems.",
    4: "Cannot respond without noticeable pauses and may speak slowly with frequent repetition; links basic sentences but with limited and/or repetitive use of connectives.",
    3: "Speaks with long pauses; has limited ability to link simple sentences.",
    2: "Pauses lengthily before most words; little communication possible.",
    1: "No communication possible; no rateable language.",
  },
  LR: {
    9: "Uses vocabulary with full flexibility and precise usage in all topics; uses idiomatic language naturally and accurately.",
    8: "Uses a wide vocabulary resource readily and flexibly to convey precise meaning; uses less common and idiomatic vocabulary skilfully, with occasional inaccuracies; uses paraphrase effectively as required.",
    7: "Uses vocabulary resource flexibly to discuss a variety of topics; uses some less common and idiomatic vocabulary and shows some awareness of style/collocation, with some inappropriate choices; uses paraphrase effectively.",
    6: "Has a wide enough vocabulary to discuss topics at length, though with some inappropriate word choice; uses paraphrase reasonably effectively.",
    5: "Manages to talk about familiar and unfamiliar topics but uses vocabulary with limited flexibility; attempts paraphrase but not always successfully.",
    4: "Is able to talk about familiar topics only, with limited flexibility; uses vocabulary that lacks precision.",
    3: "Uses simple vocabulary to convey personal information; has insufficient vocabulary for less familiar topics.",
    2: "Only produces isolated words or memorised utterances.",
    1: "No communication possible; no rateable language.",
  },
  GRA: {
    9: "Uses a full range of structures naturally and appropriately; produces consistently accurate structures apart from slips characteristic of native-speaker speech.",
    8: "Uses a wide range of structures flexibly; produces a majority of error-free sentences with only occasional inappropriacies or non-systematic errors.",
    7: "Uses a range of complex structures with some flexibility; frequently produces error-free sentences, though some grammatical mistakes persist.",
    6: "Uses a mix of simple and complex structures, but with limited flexibility; may make frequent mistakes with complex structures, though these rarely impede communication.",
    5: "Produces basic sentence forms with reasonable accuracy; uses a limited range of more complex structures, but these usually contain errors and may cause some difficulty for the listener.",
    4: "Produces basic sentence forms and some correct simple sentences but subordinate structures are rare; errors are frequent and may lead to misunderstanding.",
    3: "Attempts basic sentence forms but with limited success, or relies on apparently memorised utterances.",
    2: "Cannot produce basic sentence forms.",
    1: "No communication possible; no rateable language.",
  },
  PR: {
    9: "Uses a full range of pronunciation features with precision and subtlety in almost all instances; sustains flexible use of features throughout with only rare lapses; effortless to understand throughout.",
    8: "Uses a wide range of pronunciation features; sustains flexible use of these features, with only occasional lapses; easy to understand throughout, and any accent has minimal effect on intelligibility.",
    7: "Displays all the positive features of band 6 and some, but not all, of the positive features of band 8.",
    6: "Uses a range of pronunciation features with mixed control; shows some effective use of features but not sustained; generally can be understood throughout, though mispronunciation of individual words/sounds reduces clarity at times.",
    5: "Displays all the positive features of band 4 and some, but not all, of the positive features of band 6.",
    4: "Uses a limited range of pronunciation features; attempts to control features but lapses are frequent; mispronunciations are frequent and cause some difficulty for the listener.",
    3: "Displays some features of band 2 and some, but not all, of the positive features of band 4.",
    2: "Speech is often unintelligible.",
    1: "No communication possible; no rateable language.",
  },
};

export function getSpeakingBandDescriptor(
  criterion: SpeakingCriterionId,
  wholeBand: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9,
): string | undefined {
  return SPEAKING_DESCRIPTORS[criterion][wholeBand];
}
