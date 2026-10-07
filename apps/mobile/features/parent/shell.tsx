/**
 * ParentShell — parent workspace chrome: shared app header + tab bar.
 * Screens own their content only; top insets belong to the header, so
 * screen containers must not add their own paddingTop.
 */
import React from "react";
import { AppHeader, AppShell, type ShellTab } from "@/design-system/shell";

const TABS: ShellTab[] = [
  { href: "/parent", match: ["/parent", "/parent/index"], icon: "home", label: "Home" },
  { href: "/parent/fees", match: ["/parent/fees"], icon: "receipt-long", label: "Finance" },
  { href: "/parent/attendance", match: ["/parent/attendance"], icon: "event-available", label: "Attend." },
  { href: "/parent/homework", match: ["/parent/homework"], icon: "menu-book", label: "Homework" },
  { href: "/parent/messages", match: ["/parent/messages"], icon: "chat-bubble", label: "Messages" },
  { href: "/parent/profile", match: ["/parent/profile"], icon: "person", label: "Profile" }
];

export function ParentShell({ children }: { children: React.ReactNode }) {
  return (
    <AppShell tabs={TABS} header={<AppHeader subtitle="Parent portal" />}>
      {children}
    </AppShell>
  );
}
