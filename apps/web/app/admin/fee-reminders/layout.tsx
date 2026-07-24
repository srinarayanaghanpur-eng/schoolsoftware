"use client";

import { History, LayoutDashboard, RefreshCw, ScrollText, Settings } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/admin/fee-reminders", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/fee-reminders/settings", label: "Settings", icon: Settings },
  { href: "/admin/fee-reminders/logs", label: "Logs", icon: ScrollText },
  { href: "/admin/fee-reminders/history", label: "History", icon: History },
  { href: "/admin/fee-reminders/retry-queue", label: "Retry Queue", icon: RefreshCw },
];

export default function FeeRemindersLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div>
      <div className="flex gap-1 overflow-x-auto border-b border-[#e4e6f0] px-4 pt-4 md:px-7">
        {TABS.map((tab) => {
          const active = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex shrink-0 items-center gap-1.5 rounded-t-lg px-4 py-2.5 text-sm font-bold transition ${
                active
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-card text-muted-foreground ring-1 ring-border"
              }`}
            >
              <tab.icon size={16} />
              {tab.label}
            </Link>
          );
        })}
      </div>
      <div>{children}</div>
    </div>
  );
}
