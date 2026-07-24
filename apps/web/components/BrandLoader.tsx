export function BrandLoader({ message = "Loading…" }: { message?: string }) {
  return (
    <div className="flex min-h-[220px] items-center justify-center p-6">
      <div className="inline-flex items-center gap-3 rounded-xl border border-[#e0e3f0] bg-white px-4 py-3 text-sm font-semibold text-[#5d6690] shadow-sm dark:border-[#2a2d3a] dark:bg-[#1a1c26] dark:text-[#aeb6d8]">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#dfe3f1] border-t-[#3033a1]" aria-hidden="true" />
        <span>{message}</span>
      </div>
    </div>
  );
}
