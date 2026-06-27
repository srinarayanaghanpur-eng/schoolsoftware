import { FinanceSubnav } from "@/components/FinanceSubnav";

// Wraps every /admin/finance/* page with the Finance sub-navigation bar,
// so the sidebar only needs the single "Fees & Finance" button.
export default function FinanceLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <FinanceSubnav />
      {children}
    </div>
  );
}
