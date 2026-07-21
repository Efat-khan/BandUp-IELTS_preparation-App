"use client";

/**
 * Exports the enclosing .print-report region as a PDF via the browser's
 * native print-to-PDF — no server round trip, works offline, and needs no
 * new dependency. See the `@media print` rules in app/globals.css.
 */
export function PdfReportButton({ label = "Download PDF report" }: { label?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="print-hide w-fit self-end rounded-full border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-900"
    >
      🖨️ {label}
    </button>
  );
}
