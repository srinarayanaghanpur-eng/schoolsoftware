"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, IndianRupee, BookOpenCheck, Circle, Megaphone, MessageSquare, UserCircle } from "lucide-react";

const TABS = [
  { href: "/portal", label: "Dashboard", icon: LayoutDashboard },
  { href: "/portal/fees", label: "Fees", icon: IndianRupee },
  { href: "/portal/exams", label: "Exams", icon: BookOpenCheck },
  { href: "/portal/notices", label: "Notices", icon: Megaphone },
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
              isActive ? "bg-[#2d3094] text-white shadow-sm" : "bg-white text-[#475067] ring-1 ring-[#e3e6f0] hover:bg-[#f3f4fb]"
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
