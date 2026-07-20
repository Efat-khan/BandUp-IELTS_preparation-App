import { Mark, mergeAttributes } from "@tiptap/core";

/**
 * Renders/parses <mark data-issue data-correction data-category> spans
 * produced by lib/writing/annotate.ts's buildAnnotatedHtml(). Read-only —
 * there are no editor commands to apply this mark interactively; it only
 * ever arrives via EssayEditor's setContent(html) once scoring is done.
 */
export const ErrorHighlight = Mark.create({
  name: "errorHighlight",

  addAttributes() {
    return {
      issue: {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute("data-issue"),
        renderHTML: (attributes: Record<string, unknown>) =>
          attributes.issue ? { "data-issue": attributes.issue } : {},
      },
      correction: {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute("data-correction"),
        renderHTML: (attributes: Record<string, unknown>) =>
          attributes.correction ? { "data-correction": attributes.correction } : {},
      },
      category: {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute("data-category"),
        renderHTML: (attributes: Record<string, unknown>) =>
          attributes.category ? { "data-category": attributes.category } : {},
      },
    };
  },

  parseHTML() {
    return [{ tag: "mark[data-issue]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["mark", mergeAttributes(HTMLAttributes, { class: "error-highlight" }), 0];
  },
});
