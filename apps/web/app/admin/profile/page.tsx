"use client";

import { PageHeader } from "@/components/PageHeader";
import { useAdminSession } from "@/components/AdminSessionContext";
import { ROLE_LABELS } from "@sri-narayana/shared";
import { BadgeCheck, KeyRound, UserCircle } from "lucide-react";

function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "U";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function ProfilePage() {
  const { profile, role, permissions } = useAdminSession();
  const name = profile?.name ?? "User";
  const roleLabel = role ? ROLE_LABELS[role] : "Loading…";

  return (
    <>
      <PageHeader title="My Profile" description="Your account details and the access granted to this login." />
      <section className="grid gap-4 p-4 md:p-7 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
        <div className="card overflow-hidden">
          <div className="h-24 bg-[linear-gradient(120deg,#17217f_0%,#3033a1_60%,#6b47b8_100%)]" />
          <div className="px-5 pb-6">
            <div className="-mt-10 flex flex-wrap items-end justify-between gap-4">
              <div className="grid h-20 w-20 place-items-center rounded-2xl border-4 border-card bg-[#ffc73d] text-2xl font-extrabold text-[#2a2c87] shadow-lg">
                {initialsOf(name)}
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-extrabold text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300">
                <BadgeCheck size={15} /> Active account
              </span>
            </div>
            <h2 className="mt-4 text-2xl font-extrabold tracking-tight text-foreground">{name}</h2>
            <p className="mt-1 text-sm font-semibold text-muted-foreground">{roleLabel}</p>
            <dl className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl bg-muted/60 px-4 py-3">
                <dt className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-muted-foreground">Email</dt>
                <dd className="mt-1 truncate text-sm font-bold text-foreground">{profile?.email ?? "Not added"}</dd>
              </div>
              <div className="rounded-xl bg-muted/60 px-4 py-3">
                <dt className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-muted-foreground">User ID</dt>
                <dd className="mt-1 truncate text-sm font-bold text-foreground">{profile?.uid ?? "—"}</dd>
              </div>
            </dl>
          </div>
        </div>

        <div className="space-y-4">
          <div className="card p-5">
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                <KeyRound size={20} />
              </span>
              <div>
                <h2 className="font-extrabold text-foreground">Access</h2>
                <p className="mt-1 text-sm font-medium text-muted-foreground">
                  This login uses the {roleLabel} role. Module access is controlled by the school administrator.
                </p>
              </div>
            </div>
            <p className="mt-4 rounded-xl bg-muted/60 px-4 py-3 text-sm font-bold text-foreground">
              {permissions && permissions.length > 0 ? `${permissions.length} permissions granted` : "Role permissions are loaded from the server."}
            </p>
          </div>
          <div className="card p-5">
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#f1ecff] text-[#6b47b8]">
                <UserCircle size={20} />
              </span>
              <div>
                <h2 className="font-extrabold text-foreground">Need a change?</h2>
                <p className="mt-1 text-sm font-medium text-muted-foreground">
                  Name, role, or permission changes must be made by a super admin from Users &amp; Roles.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
