"use client";

import { AlertCircle } from "lucide-react";

/**
 * Inline, non-blocking notice for data-loading problems.
 *
 * Pages used to do `console.error(error)` when a query failed. In Next.js
 * dev mode the error overlay intercepts console.error and renders a
 * full-screen "Console Error {}" panel, which looks like a crash even when
 * the page is fine. Showing the message in the page instead keeps the UI
 * usable and tells the user what actually happened.
 */
export default function DataErrorNotice({ message }: { message: string }) {
  if (!message) return null;
  return (
    <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
      <AlertCircle size={16} className="mt-0.5 shrink-0 text-amber-600" />
      <p className="text-sm leading-relaxed text-amber-800">{message}</p>
    </div>
  );
}
