"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

type PaginationControlsProps = {
  page: number;
  pageSize?: number;
  itemCount: number;
  totalItems?: number | null;
  itemLabel?: string;
  hasPrevious: boolean;
  hasNext: boolean;
  loading?: boolean;
  onPrevious: () => void;
  onNext: () => void;
  className?: string;
};

export function PaginationControls({
  page,
  pageSize = 25,
  itemCount,
  totalItems,
  itemLabel = "rows",
  hasPrevious,
  hasNext,
  loading = false,
  onPrevious,
  onNext,
  className = ""
}: PaginationControlsProps) {
  const start = itemCount > 0 ? page * pageSize + 1 : 0;
  const end = itemCount > 0 ? page * pageSize + itemCount : 0;
  const rangeText = itemCount > 0
    ? `Showing ${start}-${end}${typeof totalItems === "number" ? ` of ${totalItems}` : ""}`
    : `No ${itemLabel} to show`;

  return (
    <div className={`flex flex-col gap-3 border-t border-[#edf0f7] p-4 sm:flex-row sm:items-center sm:justify-between ${className}`}>
      <p className="text-sm font-semibold text-[#7d86a8]">
        {rangeText} <span className="text-[#a0a8c4]">|</span> Page {page + 1} <span className="text-[#a0a8c4]">|</span> {pageSize} / page
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-[#dfe3f1] bg-white px-3 text-sm font-bold text-[#303247] transition hover:bg-[#f6f7fc] disabled:cursor-not-allowed disabled:opacity-50"
          onClick={onPrevious}
          disabled={!hasPrevious || loading}
        >
          <ChevronLeft size={16} />
          Previous
        </button>
        <button
          type="button"
          className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-[#dfe3f1] bg-white px-3 text-sm font-bold text-[#303247] transition hover:bg-[#f6f7fc] disabled:cursor-not-allowed disabled:opacity-50"
          onClick={onNext}
          disabled={!hasNext || loading}
        >
          Next
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
