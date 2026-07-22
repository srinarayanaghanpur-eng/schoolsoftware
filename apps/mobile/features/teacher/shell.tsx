/**
 * TeacherShell — teacher workspace chrome.
 * Tabs mirror the approved "Teacher App" design: Home · Tasks · Academics ·
 * Inbox · Profile.
 */
import React from "react";
import { AppShell, type ShellTab } from "@/design-system/shell";

const TABS: ShellTab[] = [
  { href: "/teacher", match: ["/teacher", "/teacher/index"], icon: "home", label: "Home" },
  { href: "/teacher/tasks", match: ["/teacher/tasks"], icon: "task-alt", label: "Tasks" },
  { href: "/teacher/academics", match: ["/teacher/academics"], icon: "school", label: "Academics" },
  { href: "/teacher/inbox", match: ["/teacher/inbox"], icon: "chat-bubble", label: "Inbox" },
  { href: "/teacher/profile", match: ["/teacher/profile"], icon: "person", label: "Profile" }
];

export function TeacherShell({ children }: { children: React.ReactNode }) {
  return <AppShell tabs={TABS}>{children}</AppShell>;
}
