import React from "react";
import { ThemedStack } from "@/lib/ThemedStack";
import { WorkspaceGuard } from "@/lib/WorkspaceGuard";
import { DriverDemoProvider } from "@/features/driver/DriverDemoContext";

export default function DriverLayout() {
  return (
    <WorkspaceGuard allowed={["driver"]}>
      <DriverDemoProvider>
        <ThemedStack animation="fade" />
      </DriverDemoProvider>
    </WorkspaceGuard>
  );
}
