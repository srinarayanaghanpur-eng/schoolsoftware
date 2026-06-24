import { memo } from "react";
import type { LucideIcon } from "lucide-react";

function StatCardInner({
  label,
  value,
  helper,
  icon: Icon
}: {
  label: string;
  value: string | number;
  helper?: string;
  icon: LucideIcon;
}) {
  return (
    <div className="card group relative overflow-hidden p-4 transition duration-300 ease-out hover:-translate-y-0.5 hover:shadow-md hover:ring-emerald-200">
      <div className="pointer-events-none absolute inset-x-0 -top-px h-0.5 origin-left scale-x-0 bg-[linear-gradient(90deg,#233128,#047857)] transition-transform duration-300 group-hover:scale-x-100" />
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-stone-500">{label}</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight text-stone-950">{value}</p>
          {helper && <p className="mt-1 text-xs text-stone-500">{helper}</p>}
        </div>
        <div className="rounded-xl bg-[linear-gradient(135deg,#ECFDF5,#D1FAE5)] p-2.5 text-emerald-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] transition duration-300 group-hover:scale-110 group-hover:bg-[linear-gradient(135deg,#233128,#047857)] group-hover:text-white">
          <Icon size={20} />
        </div>
      </div>
    </div>
  );
}

export const StatCard = memo(StatCardInner);
