import { AuthGate } from "@/components/AuthGate";
import { PortalChildProvider } from "@/components/PortalChildContext";
import { DarkModeToggle } from "@/components/DarkModeToggle";
import { PortalSubnav } from "@/components/PortalSubnav";

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGate roles={["parent"]}>
      <PortalChildProvider>
        <div className="erp-app min-h-screen bg-background text-foreground">
          <div className="sticky top-0 z-20 flex items-center justify-between border-b border-border bg-card/95 px-4 py-2 backdrop-blur">
            <span className="text-sm font-bold text-foreground">Parent Portal</span>
            <DarkModeToggle />
          </div>
          <PortalSubnav />
          {children}
        </div>
      </PortalChildProvider>
    </AuthGate>
  );
}
