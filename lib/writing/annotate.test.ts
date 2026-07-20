import { describe, expect, it } from "vitest";
import { buildAnnotatedHtml, locateInlineErrors } from "./annotate";

const ERROR = (overrides: Partial<{ quote: string; issue: string; correction: string; category: string }> = {}) => ({
  quote: "peoples jobs",
  issue: "Incorrect plural possessive form.",
  correction: "people's jobs",
  category: "grammar",
  ...overrides,
});

describe("locateInlineErrors", () => {
  it("finds an exact-match quote", () => {
    const text = "Automation will affect peoples jobs across many industries.";
    const spans = locateInlineErrors(text, [ERROR()]);
    expect(spans).toHaveLength(1);
    expect(spans[0].start).toBe(text.indexOf("peoples jobs"));
    expect(spans[0].end).toBe(spans[0].start + "peoples jobs".length);
  });

  it("falls back to case-insensitive matching", () => {
    const text = "Automation will affect Peoples Jobs across many industries.";
    const spans = locateInlineErrors(text, [ERROR()]);
    expect(spans).toHaveLength(1);
  });

  it("drops a quote that cannot be found in the text", () => {
    const text = "This essay does not contain the quoted fragment at all.";
    const spans = locateInlineErrors(text, [ERROR({ quote: "nonexistent phrase" })]);
    expect(spans).toHaveLength(0);
  });

  it("drops overlapping matches, keeping the earliest", () => {
    const text = "The quick brown fox jumps.";
    const spans = locateInlineErrors(text, [
      ERROR({ quote: "quick brown", issue: "a" }),
      ERROR({ quote: "brown fox", issue: "b" }),
    ]);
    expect(spans).toHaveLength(1);
    expect(spans[0].error.issue).toBe("a");
  });

  it("sorts spans by position regardless of input order", () => {
    const text = "First error here, then second error there.";
    const spans = locateInlineErrors(text, [
      ERROR({ quote: "second error", issue: "second" }),
      ERROR({ quote: "First error", issue: "first" }),
    ]);
    expect(spans.map((s) => s.error.issue)).toEqual(["first", "second"]);
  });
});

describe("buildAnnotatedHtml", () => {
  it("wraps matched spans in a <mark> with data attributes", () => {
    const text = "Automation will affect peoples jobs.";
    const spans = locateInlineErrors(text, [ERROR()]);
    const html = buildAnnotatedHtml(text, spans);
    expect(html).toContain('<mark data-issue="Incorrect plural possessive form."');
    expect(html).toContain('data-correction="people&#39;s jobs"');
    expect(html).toContain('data-category="grammar"');
    expect(html).toContain(">peoples jobs</mark>");
  });

  it("escapes HTML-significant characters in both text and attributes", () => {
    const text = 'He said "cats & dogs" <loudly>.';
    const html = buildAnnotatedHtml(text, []);
    expect(html).not.toContain("<loudly>");
    expect(html).toContain("&lt;loudly&gt;");
    expect(html).toContain("&amp;");
  });

  it("wraps blank-line-separated paragraphs in <p> tags", () => {
    const text = "First paragraph.\n\nSecond paragraph.";
    const html = buildAnnotatedHtml(text, []);
    expect(html).toBe("<p>First paragraph.</p><p>Second paragraph.</p>");
  });

  it("produces plain unmarked HTML when there are no spans", () => {
    const text = "Nothing wrong here.";
    const html = buildAnnotatedHtml(text, []);
    expect(html).toBe("<p>Nothing wrong here.</p>");
  });
});
