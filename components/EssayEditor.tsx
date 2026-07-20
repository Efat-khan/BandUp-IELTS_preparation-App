"use client";

import { useEffect, useRef, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { ErrorHighlight } from "./errorHighlightMark";
import { buildAnnotatedHtml, locateInlineErrors, type InlineErrorLike } from "@/lib/writing/annotate";

interface HoverTooltip {
  issue: string;
  correction: string;
  category: string;
  x: number;
  y: number;
}

interface EssayEditorProps {
  /** Initial content while editable; the full essay text once read-only. */
  value: string;
  onChange?: (text: string) => void;
  editable: boolean;
  /** Inline errors to highlight — only applied once `editable` is false. */
  errors?: InlineErrorLike[];
  placeholder?: string;
}

/**
 * TipTap-based essay editor. Writing phase: plain editable rich-text
 * input (parent reads plain text via onChange for word count/submission).
 * Results phase (editable=false): re-renders as read-only with inline
 * grammar/vocab errors highlighted — hovering a highlight shows the issue,
 * the suggested correction, and the rule/category violated.
 */
export function EssayEditor({ value, onChange, editable, errors, placeholder }: EssayEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoverTooltip, setHoverTooltip] = useState<HoverTooltip | null>(null);

  const editor = useEditor({
    extensions: [StarterKit, ErrorHighlight],
    content: value ? `<p>${value.replace(/\n/g, "<br>")}</p>` : "",
    editable,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class:
          "tiptap prose prose-sm max-w-none min-h-[240px] outline-none [&_mark.error-highlight]:cursor-help [&_mark.error-highlight]:bg-red-200/70 dark:[&_mark.error-highlight]:bg-red-900/50",
      },
    },
    onUpdate: ({ editor }) => {
      onChange?.(editor.getText());
    },
  });

  useEffect(() => {
    editor?.setEditable(editable);
  }, [editable, editor]);

  useEffect(() => {
    if (!editor || editable) return;
    const spans = locateInlineErrors(value, errors ?? []);
    editor.commands.setContent(buildAnnotatedHtml(value, spans));
  }, [editable, errors, value, editor]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    function handleOver(e: MouseEvent) {
      const target = (e.target as HTMLElement).closest?.("mark[data-issue]") as HTMLElement | null;
      if (!target || !container) {
        setHoverTooltip(null);
        return;
      }
      const rect = target.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      setHoverTooltip({
        issue: target.getAttribute("data-issue") ?? "",
        correction: target.getAttribute("data-correction") ?? "",
        category: target.getAttribute("data-category") ?? "",
        x: rect.left - containerRect.left,
        y: rect.top - containerRect.top,
      });
    }
    function handleOut(e: MouseEvent) {
      const related = e.relatedTarget as HTMLElement | null;
      if (related?.closest?.("mark[data-issue]")) return;
      setHoverTooltip(null);
    }

    container.addEventListener("mouseover", handleOver);
    container.addEventListener("mouseout", handleOut);
    return () => {
      container.removeEventListener("mouseover", handleOver);
      container.removeEventListener("mouseout", handleOut);
    };
  }, []);

  const isEmpty = editable && editor?.isEmpty;

  return (
    <div ref={containerRef} className="relative">
      <EditorContent
        editor={editor}
        className="rounded-md border border-zinc-300 bg-white p-3 text-zinc-900 focus-within:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
      />
      {isEmpty && placeholder && (
        <p className="pointer-events-none absolute left-3 top-3 text-sm text-zinc-400">{placeholder}</p>
      )}
      {hoverTooltip && (
        <div
          className="pointer-events-none absolute z-10 max-w-xs -translate-y-full rounded-md bg-zinc-900 p-2 text-xs text-white shadow-lg dark:bg-zinc-100 dark:text-zinc-900"
          style={{ left: hoverTooltip.x, top: hoverTooltip.y - 6 }}
        >
          <p className="font-medium uppercase tracking-wide opacity-70">{hoverTooltip.category}</p>
          <p>{hoverTooltip.issue}</p>
          <p className="mt-1 text-emerald-400 dark:text-emerald-700">→ {hoverTooltip.correction}</p>
        </div>
      )}
    </div>
  );
}
