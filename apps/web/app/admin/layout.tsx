import { AuthGate } from "@/components/AuthGate";
import { OptimizedAppLayout } from "@/components/OptimizedAppLayout";
import { ROLES } from "@sri-narayana/shared";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGate roles={ROLES}>
      <OptimizedAppLayout>{children}</OptimizedAppLayout>
    </AuthGate>
  );
}
