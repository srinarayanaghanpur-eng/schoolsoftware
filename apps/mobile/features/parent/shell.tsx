/**
 * Parent workspace chrome. Badges mirror the supplied Parent App reference
 * until the homework/messages summary endpoints expose unread counts.
 */
import React from "react";
import { AppShell, type ShellTab } from "@/design-system/shell";

const TABS: ShellTab[] = [
  { href: "/parent", match: ["/parent", "/parent/index"], icon: "home", label: "Home" },
  {
    href: "/parent/homework",
    match: ["/parent/homework"],
    icon: "menu-book",
    label: "Homework",
    badge: 2
  },
  {
    href: "/parent/messages",
    match: ["/parent/messages"],
    icon: "chat-bubble",
    label: "Messages",
    badge: 2
  },
  { href: "/parent/profile", match: ["/parent/profile"], icon: "person", label: "Profile" }
];

export function ParentShell({ children }: { children: React.ReactNode }) {
  return <AppShell tabs={TABS}>{children}</AppShell>;
}
