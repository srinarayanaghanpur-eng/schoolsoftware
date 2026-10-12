import React from "react";
import { PrincipalShell } from "@/features/admin/shell";
import { ExamsScreen } from "@/features/admin/screens";

export default function PrincipalExamsRoute() {
  return (
    <PrincipalShell>
      <ExamsScreen />
    </PrincipalShell>
  );
}
