"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Banknote, BarChart3, Bell, Building2, FileStack, FileText, Landmark, Layers, ReceiptIndianRupee, ScrollText, Tag, Wallet } from "lucide-react";

const TABS = [
  { href: "/admin/finance", label: "Dashboard", icon: BarChart3 },
  { href: "/admin/payments", label: "Collect Fee", icon: ReceiptIndianRupee },
  { href: "/admin/fee-structures", label: "Fee Structures", icon: Layers },
  { href: "/admin/fee-concessions", label: "Concessions", icon: Tag },
  { href: "/admin/finance/expenses", label: "Expenses", icon: Wallet },
  { href: "/admin/finance/income", label: "Income", icon: Banknote },
  { href: "/admin/finance/dues", label: "Dues", icon: FileStack },
  { href: "/admin/finance/reminders", label: "Reminders", icon: Bell },
  { href: "/admin/finance/invoices", label: "Invoices", icon: FileText },
  { href: "/admin/finance/vendors", label: "Vendors", icon: Building2 },
  { href: "/admin/finance/banking", label: "Banking", icon: Landmark },
  { href: "/admin/finance/ledger", label: "Ledger", icon: ScrollText },
  { href: "/admin/fee-reports", label: "Reports", icon: BarChart3 }
];

/** Horizontal sub-navigation shown at the top of every Finance page. */
export function FinanceSubnav() {
  const pathname = usePathname();
  return (
    <nav className="flex flex-wrap gap-2 px-4 pt-4 md:px-7">
      {TABS.map(({ href, label, icon: Icon }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            className={`inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-sm font-semibold transition ${
              active ? "bg-[#2d3094] text-white shadow-sm" : "bg-white text-[#475067] ring-1 ring-[#e3e6f0] hover:bg-[#f3f4fb]"
            }`}
          >
            <Icon size={15} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
