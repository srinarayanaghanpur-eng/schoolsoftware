"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, IndianRupee, BookOpenCheck, Circle, Megaphone,
  MessageSquare, UserCircle, CalendarDays, Clock, Bus, Download, GraduationCap,
} from "lucide-react";

const TABS = [
  { href: "/portal", label: "Dashboard", icon: LayoutDashboard },
  { href: "/portal/attendance", label: "Attendance", icon: Clock },
  { href: "/portal/homework", label: "Homework", icon: BookOpenCheck },
  { href: "/portal/fees", label: "Fees", icon: IndianRupee },
  { href: "/portal/exams", label: "Exams", icon: GraduationCap },
  { href: "/portal/notices", label: "Notices", icon: Megaphone },
  { href: "/portal/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/portal/transport", label: "Transport", icon: Bus },
  { href: "/portal/downloads", label: "Downloads", icon: Download },
  { href: "/portal/contact", label: "Contact", icon: MessageSquare },
  { href: "/portal/profile", label: "Profile", icon: UserCircle },
];

export function PortalSubnav() {
  const pathname = usePathname();
  return (
    <nav className="flex flex-wrap gap-2 px-4 pt-4 md:px-7">
      {TABS.filter(Boolean).map(({ href, label, icon }) => {
        const isActive = pathname === href || (href !== "/portal" && pathname.startsWith(`${href}/`));
        const Icon = icon ?? Circle;
        return (
          <Link
            key={href}
            href={href}
            className={`inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-sm font-semibold transition ${
              isActive ? "bg-primary text-primary-foreground shadow-sm" : "bg-card text-muted-foreground ring-1 ring-border hover:bg-muted hover:text-foreground"
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
