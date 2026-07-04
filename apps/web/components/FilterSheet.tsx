"use client";

import { SlidersHorizontal, X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

export type ActiveFilter = { key: string; label: string; onClear: () => void };

type Props = {
  /** The filter controls (selects, inputs). Laid out inline on desktop, stacked in the sheet on mobile. */
  children: ReactNode;
  /** Active filter chips shown under the title on mobile (and inline on desktop). */
  active?: ActiveFilter[];
  onClearAll?: () => void;
  /** Optional trailing controls always visible on desktop (e.g. a search box). */
  inlineExtra?: ReactNode;
};

/**
 * Responsive filter surface.
 * - Desktop/tablet (md+): filters render inline as a wrapped row.
 * - Mobile: filters collapse behind a "Filters" button that opens a bottom
 *   sheet; active selections show as removable chips under the title.
 */
export function FilterSheet({ children, active = [], onClearAll, inlineExtra }: Props) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="w-full">
      {/* Desktop: inline filter row */}
      <div className="hidden flex-wrap items-center gap-3 md:flex">
        {children}
        {inlineExtra}
      </div>

      {/* Mobile: trigger + chips */}
      <div className="md:hidden">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="btn-secondary flex-1 justify-center"
          >
            <SlidersHorizontal size={16} /> Filters
            {active.length > 0 && (
              <span className="ml-1 grid h-5 min-w-[20px] place-items-center rounded-full bg-primary px-1 text-[11px] font-extrabold text-primary-foreground">
                {active.length}
              </span>
            )}
          </button>
          {inlineExtra && <div className="flex-1">{inlineExtra}</div>}
        </div>

        {active.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {active.map((f) => (
              <button key={f.key} type="button" onClick={f.onClear} className="filter-chip">
                {f.label} <X size={12} />
              </button>
            ))}
            {onClearAll && (
              <button type="button" onClick={onClearAll} className="text-xs font-bold text-primary underline">
                Clear all
              </button>
            )}
          </div>
        )}
      </div>

      {/* Mobile bottom sheet */}
      {open && (
        <div className="fixed inset-0 z-[60] flex items-end bg-black/50 backdrop-blur-sm md:hidden" onClick={() => setOpen(false)}>
          <div
            className="max-h-[85vh] w-full overflow-y-auto rounded-t-3xl bg-card p-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-extrabold text-foreground">Filters</h3>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close filters" className="grid h-9 w-9 place-items-center rounded-lg bg-muted text-foreground">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-3 [&_.field]:w-full [&_select]:w-full">{children}</div>
            <div className="form-sticky-footer -mx-4 -mb-4 mt-4 flex gap-3">
              {onClearAll && (
                <button type="button" onClick={() => { onClearAll(); }} className="btn-secondary flex-1">
                  Clear all
                </button>
              )}
              <button type="button" onClick={() => setOpen(false)} className="btn-primary flex-1">
                Show results
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
