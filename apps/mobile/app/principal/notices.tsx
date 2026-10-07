import React from "react";
import { PrincipalShell } from "@/features/admin/shell";
import { NoticesScreen } from "../admin/notices";

export default function PrincipalNoticesRoute() {
  return (
    <PrincipalShell>
      <NoticesScreen />
    </PrincipalShell>
  );
}
