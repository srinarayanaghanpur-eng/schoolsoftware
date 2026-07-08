"use client";

export function FinanceTabs({ tabs, active, onChange }: {
  tabs: { id: string; label: string }[];
  active: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="flex gap-1 overflow-x-auto border-b border-[#e2e8f0]">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          className={`whitespace-nowrap px-4 py-2.5 text-sm font-bold transition border-b-2 -mb-px ${
            active === tab.id
              ? "border-[#2563eb] text-[#2563eb]"
              : "border-transparent text-[#64748b] hover:text-[#1e293b]"
          }`}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

export const FINANCE_TABS = [
  { id: "overview", label: "Overview" },
  { id: "collection", label: "Fee Collection" },
  { id: "payments", label: "Payments" },
  { id: "dues", label: "Dues" },
  { id: "expenses", label: "Expenses" },
  { id: "settlements", label: "Settlements" },
  { id: "receipts", label: "Receipts" },
  { id: "transfers", label: "Bank Transfers" },
  { id: "reports", label: "Reports" },
];
