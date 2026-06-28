"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Banknote, BarChart3, Bell, BookOpen, Building2, CalendarCheck, DollarSign, FileStack, FileText, Landmark, Layers, ReceiptIndianRupee, ScrollText, Tag, TrendingDown, TrendingUp, Users, Wallet } from "lucide-react";

const TABS = [
  { href: "/admin/finance", label: "Dashboard", icon: BarChart3 },
  { href: "/admin/payments", label: "Collect Fee", icon: ReceiptIndianRupee },
  { href: "/admin/fee-structures", label: "Fee Structures", icon: Layers },
  { href: "/admin/fee-concessions", label: "Concessions", icon: Tag },
  { href: "/admin/finance/expenses", label: "Expenses", icon: Wallet },
  { href: "/admin/finance/income", label: "Income", icon: Banknote },
  { href: "/admin/finance/dues", label: "Dues", icon: FileStack },
  { href: "/admin/finance/installments", label: "Installments", icon: Layers },
  { href: "/admin/finance/reminders", label: "Reminders", icon: Bell },
  { href: "/admin/finance/collections", label: "Closing", icon: CalendarCheck },
  { href: "/admin/finance/statements", label: "Statements", icon: Users },
  { href: "/admin/finance/defaulters", label: "Defaulters", icon: FileStack },
  { href: "/admin/finance/receipts", label: "Receipts", icon: ScrollText },
  { href: "/admin/finance/invoices", label: "Invoices", icon: FileText },
  { href: "/admin/finance/vendors", label: "Vendors", icon: Building2 },
  { href: "/admin/finance/banking", label: "Bank Book", icon: Landmark },
  { href: "/admin/finance/cash-book", label: "Cash Book", icon: Banknote },
  { href: "/admin/finance/ledger", label: "Ledger", icon: ScrollText },
  { href: "/admin/finance/trial-balance", label: "Trial Balance", icon: BookOpen },
  { href: "/admin/finance/profit-loss", label: "P&L", icon: TrendingUp },
  { href: "/admin/finance/payables", label: "Payables", icon: TrendingDown },
  { href: "/admin/finance/receivables", label: "Receivables", icon: DollarSign },
  { href: "/admin/finance/deleted-bills", label: "Deleted Bills", icon: FileText },
  { href: "/admin/finance/branch-accounts", label: "Branch Accts", icon: Building2 },
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
