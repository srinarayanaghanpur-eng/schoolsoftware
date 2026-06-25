import { memo } from "react";

function PageHeaderInner({
  title,
  description,
  action
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="dashboard-animate px-4 pt-5 md:px-7">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <h2 className="text-[22px] font-extrabold leading-tight tracking-tight text-[#1b1d32]">{title}</h2>
          {description && <p className="mt-1 max-w-3xl text-sm font-medium text-[#7d86a8]">{description}</p>}
        </div>
        {action && <div className="flex shrink-0 flex-wrap gap-2">{action}</div>}
      </div>
    </div>
  );
}

export const PageHeader = memo(PageHeaderInner);
