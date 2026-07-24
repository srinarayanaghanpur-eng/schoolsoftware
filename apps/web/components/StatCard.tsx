import { memo } from "react";
import { Circle, type LucideIcon } from "lucide-react";

function StatCardInner({
  label,
  value,
  helper,
  icon: Icon,
  tone = "bg-[#eeefff] text-[#3033a1] dark:bg-indigo-500/15 dark:text-indigo-200"
}: {
  label: string;
  value: string | number;
  helper?: string;
  icon?: LucideIcon;
  tone?: string;
}) {
  const SafeIcon = Icon ?? Circle;
  return (
    <div className="card dashboard-animate group p-4 transition duration-200 hover:-translate-y-0.5 hover:border-ring/40 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold text-muted-foreground sm:text-sm">{label}</p>
          <p className="mt-2 text-[24px] font-extrabold leading-none tabular-nums tracking-tight text-foreground dark:text-white sm:mt-3 sm:text-[28px] xl:text-[32px]">{value}</p>
          {helper && <p className="mt-1.5 truncate text-xs font-semibold text-muted-foreground sm:mt-2 sm:text-sm">{helper}</p>}
        </div>
        <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl transition duration-200 group-hover:scale-105 sm:h-11 sm:w-11 ${tone}`}>
          <SafeIcon size={20} strokeWidth={2.25} />
        </div>
      </div>
    </div>
  );
}

export const StatCard = memo(StatCardInner);
