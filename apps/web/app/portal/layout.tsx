import { AuthGate } from "@/components/AuthGate";
import { PortalChildProvider } from "@/components/PortalChildContext";
import { DarkModeToggle } from "@/components/DarkModeToggle";

// /portal is the family portal for the parent role. The gate
// here is the single source of protection for the whole area (logged-out users
// go to /login; back-office/teacher roles get /unauthorized) so no protected
// content or sidebar renders before the auth check resolves.
export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGate roles={["parent"]}>
      <PortalChildProvider>
        <div className="erp-app min-h-screen bg-background text-foreground">
          <div className="sticky top-0 z-20 flex items-center justify-end border-b border-border bg-card/95 px-4 py-2 backdrop-blur">
            <DarkModeToggle />
          </div>
          {children}
        </div>
      </PortalChildProvider>
    </AuthGate>
  );
}
