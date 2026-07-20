/**
 * Pure logic for the inline-annotation UI: locates each inline_errors[]
 * quote inside the candidate's raw essay text, then builds an HTML string
 * with matched spans wrapped in <mark data-issue data-correction
 * data-category> for the TipTap ErrorHighlight mark to parse (see
 * components/errorHighlightMark.ts). No Gemini/DOM dependency — fully
 * testable in isolation.
 */

export interface InlineErrorLike {
  quote: string;
  issue: string;
  correction: string;
  category: string;
}

export interface TextSpan {
  start: number;
  end: number;
  error: InlineErrorLike;
}

/**
 * Finds each error's quote in the text (exact match, falling back to
 * case-insensitive), drops any that can't be found, then drops overlapping
 * matches (keeping the earliest-starting one) so spans never nest or cross.
 */
export function locateInlineErrors(text: string, errors: InlineErrorLike[]): TextSpan[] {
  const candidates: TextSpan[] = [];

  for (const error of errors) {
    const quote = error.quote.trim();
    if (!quote) continue;

    let index = text.indexOf(quote);
    if (index === -1) {
      index = text.toLowerCase().indexOf(quote.toLowerCase());
    }
    if (index === -1) continue;

    candidates.push({ start: index, end: index + quote.length, error });
  }

  candidates.sort((a, b) => a.start - b.start);

  const nonOverlapping: TextSpan[] = [];
  let lastEnd = -1;
  for (const span of candidates) {
    if (span.start >= lastEnd) {
      nonOverlapping.push(span);
      lastEnd = span.end;
    }
  }
  return nonOverlapping;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Builds paragraph-aware HTML with matched spans wrapped in a <mark> that
 * carries the issue/correction/category as data attributes.
 */
export function buildAnnotatedHtml(text: string, spans: TextSpan[]): string {
  let cursor = 0;
  const parts: string[] = [];

  for (const span of spans) {
    parts.push(escapeHtml(text.slice(cursor, span.start)));
    const quoted = escapeHtml(text.slice(span.start, span.end));
    parts.push(
      `<mark data-issue="${escapeHtml(span.error.issue)}" data-correction="${escapeHtml(
        span.error.correction,
      )}" data-category="${escapeHtml(span.error.category)}">${quoted}</mark>`,
    );
    cursor = span.end;
  }
  parts.push(escapeHtml(text.slice(cursor)));

  return parts
    .join("")
    .split(/\n\s*\n/)
    .map((paragraph) => `<p>${paragraph.replace(/\n/g, "<br>")}</p>`)
    .join("");
}
