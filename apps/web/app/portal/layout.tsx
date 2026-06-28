import { PortalSubnav } from "@/components/PortalSubnav";

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <PortalSubnav />
      {children}
    </div>
  );
}
