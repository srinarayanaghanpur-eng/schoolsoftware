import { AuthGate } from "@/components/AuthGate";
import { FinanceSubnav } from "@/components/FinanceSubnav";

// Wraps every /admin/finance/* page with the Finance sub-navigation bar,
// so the sidebar only needs the single "Fees & Finance" button.
//
// Finance holds branch accounts, income/expense, ledger and bank/cash books, so
// it carries its own explicit AuthGate (defence-in-depth on top of the route
// table) limiting it to super_admin, admin and accountant.
export default function FinanceLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGate roles={["super_admin", "admin", "accountant"]}>
      <div>
        <FinanceSubnav />
        {children}
      </div>
    </AuthGate>
  );
}
