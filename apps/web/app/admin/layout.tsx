import { AuthGate } from "@/components/AuthGate";
import { OptimizedAppLayout } from "@/components/OptimizedAppLayout";
import SyncStatusBanner from "@/components/SyncStatusBanner";

// /admin is the shared back-office panel. With no explicit roles prop, AuthGate
// derives the allowed roles from the central route table (lib/routeAccess):
// back-office roles for /admin/*, and the stricter sub-rules for /admin/finance,
// /admin/settings, /admin/users, /admin/roles. Teacher/parent/student are
// redirected to /unauthorized; logged-out users go to /login.
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGate>
      <OptimizedAppLayout>
        {children}
        <SyncStatusBanner />
      </OptimizedAppLayout>
    </AuthGate>
  );
}
