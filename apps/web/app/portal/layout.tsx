import { PortalChildProvider } from "@/components/PortalChildContext";

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <PortalChildProvider>
      <div>
        {children}
      </div>
    </PortalChildProvider>
  );
}
