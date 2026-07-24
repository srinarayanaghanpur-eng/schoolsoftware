"use client";

import { PageHeader } from "@/components/PageHeader";
import { useAdminSession } from "@/components/AdminSessionContext";
import { ROLE_LABELS } from "@sri-narayana/shared";
import { ShieldCheck } from "lucide-react";

export default function PortalPage() {
  const { profile, role } = useAdminSession();

  return (
    <>
      <PageHeader title="Portal" description={role ? `${ROLE_LABELS[role]} workspace` : "Workspace"} />
      <section className="p-4 md:p-7">
        <div className="card flex max-w-2xl items-start gap-4 p-5">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#eef0ff] text-[#3033a1]">
            <ShieldCheck size={22} />
          </span>
          <div>
            <h2 className="text-lg font-extrabold text-[#1f2136]">{profile?.name ?? "Portal"}</h2>
            <p className="mt-1 text-sm font-medium text-[#7d86a8]">
              {role ? ROLE_LABELS[role] : "User"} access is active.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
