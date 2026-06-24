import { AuthGate } from "@/components/AuthGate";
import { OptimizedAppLayout } from "@/components/OptimizedAppLayout";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGate role="admin">
      <OptimizedAppLayout>{children}</OptimizedAppLayout>
    </AuthGate>
  );
}
