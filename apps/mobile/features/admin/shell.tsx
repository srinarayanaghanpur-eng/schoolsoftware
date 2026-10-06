/**
 * Workspace shells for the management roles.
 * Thin AppShell wrappers — tab sets preserved, chrome owned by design-system.
 */
import React from "react";
import { AppHeader, AppShell, type ShellTab } from "@/design-system/shell";

const ADMIN_TABS: ShellTab[] = [
  { href: "/admin", match: ["/admin", "/admin/index"], icon: "home", label: "Home" },
  { href: "/admin/fees", match: ["/admin/fees"], icon: "receipt-long", label: "Finance" },
  { href: "/admin/notices", match: ["/admin/notices"], icon: "campaign", label: "Notices" },
  { href: "/admin/profile", match: ["/admin/profile"], icon: "person", label: "Profile" }
];

const PRINCIPAL_TABS: ShellTab[] = [
  { href: "/principal", match: ["/principal", "/principal/index"], icon: "home", label: "Home" },
  { href: "/principal/approvals", match: ["/principal/approvals"], icon: "task-alt", label: "Verify" },
  { href: "/principal/staff", match: ["/principal/staff"], icon: "group", label: "Staff" },
  { href: "/principal/notices", match: ["/principal/notices"], icon: "campaign", label: "Notices" },
  { href: "/principal/profile", match: ["/principal/profile"], icon: "person", label: "Profile" }
];

const ACCOUNTANT_TABS: ShellTab[] = [
  { href: "/accountant", match: ["/accountant", "/accountant/index"], icon: "dashboard", label: "Home" },
  { href: "/accountant/collections", match: ["/accountant/collections"], icon: "receipt-long", label: "Collections" },
  { href: "/accountant/dues", match: ["/accountant/dues"], icon: "schedule", label: "Dues" },
  { href: "/accountant/notices", match: ["/accountant/notices"], icon: "campaign", label: "Notices" },
  { href: "/accountant/profile", match: ["/accountant/profile"], icon: "person-outline", label: "Profile" }
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  return (
    <AppShell tabs={ADMIN_TABS} header={<AppHeader subtitle="Administrator" />}>
      {children}
    </AppShell>
  );
}

export function PrincipalShell({ children }: { children: React.ReactNode }) {
  return (
    <AppShell tabs={PRINCIPAL_TABS} header={<AppHeader subtitle="Principal" />}>
      {children}
    </AppShell>
  );
}

export function AccountantShell({ children }: { children: React.ReactNode }) {
  return (
    <AppShell tabs={ACCOUNTANT_TABS} header={<AppHeader subtitle="Accountant" />}>
      {children}
    </AppShell>
  );
}
