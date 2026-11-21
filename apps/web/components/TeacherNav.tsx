"use client";

import clsx from "clsx";
import { BookOpen, ClipboardCheck, LayoutDashboard, NotebookPen, Users, Wallet } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/teacher/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/teacher/homework", label: "Homework", icon: BookOpen },
  { href: "/teacher/assignments", label: "My Classes", icon: Users },
  { href: "/teacher/attendance", label: "Attendance", icon: ClipboardCheck },
  { href: "/teacher/lesson-plans", label: "Lesson Plans", icon: NotebookPen },
  { href: "/teacher/salary", label: "Salary", icon: Wallet }
];

export function TeacherNav() {
  const pathname = usePathname();

  return (
    <nav className="flex min-w-0 items-center gap-1 overflow-x-auto">
      {links.map((link) => {
        const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
        const Icon = link.icon;
        return (
          <Link
            key={link.href}
            href={link.href}
            className={clsx(
              "inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-bold transition",
              active
                ? "bg-[#eeefff] text-[#3033a1]"
                : "text-[#6f7899] hover:bg-[#f3f4fb] hover:text-[#3033a1]"
            )}
          >
            <Icon size={16} />
            <span className="whitespace-nowrap">{link.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
