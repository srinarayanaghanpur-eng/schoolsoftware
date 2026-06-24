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
    <div className="flex flex-col gap-3 border-b border-stone-200 bg-white px-4 py-5 md:flex-row md:items-center md:justify-between md:px-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-normal text-stone-950">{title}</h1>
        {description && <p className="mt-1 text-sm text-stone-500">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export const PageHeader = memo(PageHeaderInner);
