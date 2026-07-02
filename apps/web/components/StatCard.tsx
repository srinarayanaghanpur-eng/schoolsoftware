import { memo } from "react";
import { Circle, type LucideIcon } from "lucide-react";

function StatCardInner({
  label,
  value,
  helper,
  icon: Icon,
  tone = "bg-[#eeefff] text-[#3033a1]"
}: {
  label: string;
  value: string | number;
  helper?: string;
  icon?: LucideIcon;
  tone?: string;
}) {
  const SafeIcon = Icon ?? Circle;
  return (
    <div className="card dashboard-animate group p-5 transition duration-200 hover:-translate-y-0.5 hover:border-[#c7caf0]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[#7d86a8]">{label}</p>
          <p className="mt-3 text-[32px] font-extrabold leading-none tabular-nums tracking-tight text-[#1b1d32]">{value}</p>
          {helper && <p className="mt-2 text-sm font-semibold text-[#7d86a8]">{helper}</p>}
        </div>
        <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl transition duration-200 group-hover:scale-105 ${tone}`}>
          <SafeIcon size={21} strokeWidth={2.25} />
        </div>
      </div>
    </div>
  );
}

export const StatCard = memo(StatCardInner);
