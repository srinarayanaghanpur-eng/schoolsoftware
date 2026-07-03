"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Section groups whose sub-pages show as on-page tabs (so the sidebar stays
// a short list of single main buttons). Finance has its own FinanceSubnav.
const GROUPS: { href: string; label: string }[][] = [
  [
    { href: "/admin/attendance", label: "Records" },
    { href: "/admin/reports", label: "Reports" }
  ],
  [
    { href: "/admin/calendar", label: "Timetable" },
    { href: "/admin/holidays", label: "Holidays" }
  ],
  [
    { href: "/admin/settings", label: "Settings" },
    { href: "/admin/biometric", label: "Biometric Devices" },
    { href: "/admin/backup", label: "Backup & Restore" }
  ],
  [
    { href: "/admin/notices", label: "Notices" },
    { href: "/admin/notifications", label: "Requests & Logs" }
  ]
];

/** Renders the tab row for the section the current path belongs to, else nothing. */
export function SectionTabs() {
  const pathname = usePathname();
  const group = GROUPS.find((g) => g.some((t) => t.href === pathname));
  if (!group) return null;
  return (
    <nav className="flex flex-wrap gap-2 px-4 pt-4 md:px-7">
      {group.map(({ href, label }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            className={`inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-sm font-semibold transition ${
              active ? "bg-primary text-primary-foreground shadow-sm" : "bg-card text-muted-foreground ring-1 ring-border hover:bg-muted hover:text-foreground"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
