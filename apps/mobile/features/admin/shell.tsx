/**
 * Workspace shells for the management roles.
 * Tab sets mirror the approved Admin and Principal App designs.
 */
import React from "react";
import { AppShell, type ShellTab } from "@/design-system/shell";

const ADMIN_TABS: ShellTab[] = [
  { href: "/admin", match: ["/admin", "/admin/index"], icon: "home", label: "Home" },
  { href: "/admin/fees", match: ["/admin/fees"], icon: "receipt-long", label: "Fees" },
  { href: "/admin/notices", match: ["/admin/notices"], icon: "campaign", label: "Notices" },
  { href: "/admin/profile", match: ["/admin/profile"], icon: "person", label: "Profile" }
];

const PRINCIPAL_TABS: ShellTab[] = [
  { href: "/principal", match: ["/principal", "/principal/index"], icon: "home", label: "Home" },
  { href: "/principal/approvals", match: ["/principal/approvals"], icon: "task-alt", label: "Verify" },
  { href: "/principal/staff", match: ["/principal/staff"], icon: "group", label: "Staff" },
  { href: "/principal/profile", match: ["/principal/profile"], icon: "person", label: "Profile" }
];

const ACCOUNTANT_TABS: ShellTab[] = [
  { href: "/accountant", match: ["/accountant", "/accountant/index"], icon: "dashboard", label: "Home" },
  { href: "/accountant/collections", match: ["/accountant/collections"], icon: "receipt-long", label: "Collections" },
  { href: "/accountant/dues", match: ["/accountant/dues"], icon: "schedule", label: "Dues" },
  { href: "/accountant/profile", match: ["/accountant/profile"], icon: "person-outline", label: "Profile" }
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  return <AppShell tabs={ADMIN_TABS}>{children}</AppShell>;
}

export function PrincipalShell({ children }: { children: React.ReactNode }) {
  return <AppShell tabs={PRINCIPAL_TABS}>{children}</AppShell>;
}

export function AccountantShell({ children }: { children: React.ReactNode }) {
  return <AppShell tabs={ACCOUNTANT_TABS}>{children}</AppShell>;
}
