import { PortalChildProvider } from "@/components/PortalChildContext";
import { PortalSubnav } from "@/components/PortalSubnav";

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <PortalChildProvider>
      <div>
        <PortalSubnav />
        {children}
      </div>
    </PortalChildProvider>
  );
}
