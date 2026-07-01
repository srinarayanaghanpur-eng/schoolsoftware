import { AuthGate } from "@/components/AuthGate";
import { PortalChildProvider } from "@/components/PortalChildContext";
import { DarkModeToggle } from "@/components/DarkModeToggle";

// /portal is the family portal, shared by parent and student roles. The gate
// here is the single source of protection for the whole area (logged-out users
// go to /login; back-office/teacher roles get /unauthorized) so no protected
// content or sidebar renders before the auth check resolves.
export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGate roles={["parent", "student"]}>
      <PortalChildProvider>
        <div className="min-h-screen bg-white text-[#181a31] dark:bg-[#0f1117] dark:text-[#e2e4ec]">
          <div className="sticky top-0 z-20 flex items-center justify-end border-b border-[#e4e6f0] bg-white/95 px-4 py-2 backdrop-blur dark:border-[#2a2d3a] dark:bg-[#13151e]/95">
            <DarkModeToggle />
          </div>
          {children}
        </div>
      </PortalChildProvider>
    </AuthGate>
  );
}
