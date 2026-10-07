/**
 * TeacherShell — teacher workspace chrome: shared app header + tab bar.
 * Screens own their content only; top insets belong to the header, so
 * screen containers must not add their own paddingTop.
 */
import React from "react";
import { AppHeader, AppShell, type ShellTab } from "@/design-system/shell";

const TABS: ShellTab[] = [
  { href: "/teacher", match: ["/teacher", "/teacher/index"], icon: "home", label: "Home" },
  { href: "/teacher/attendance", match: ["/teacher/attendance"], icon: "how-to-reg", label: "Attend." },
  { href: "/teacher/academics", match: ["/teacher/academics"], icon: "school", label: "Academics" },
  { href: "/teacher/tasks", match: ["/teacher/tasks"], icon: "task-alt", label: "Tasks" },
  { href: "/teacher/inbox", match: ["/teacher/inbox"], icon: "mail-outline", label: "Inbox" },
  { href: "/teacher/profile", match: ["/teacher/profile"], icon: "person", label: "Profile" }
];

export function TeacherShell({ children }: { children: React.ReactNode }) {
  return (
    <AppShell tabs={TABS} header={<AppHeader subtitle="Teacher" />}>
      {children}
    </AppShell>
  );
}
