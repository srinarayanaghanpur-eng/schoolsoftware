import { AuthGate } from "@/components/AuthGate";

// Finance holds branch accounts, income/expense, ledger and bank/cash books, so
// it carries its own explicit AuthGate (defence-in-depth on top of the route
// table) limiting it to super_admin and accountant.
export default function FinanceLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGate roles={["super_admin", "accountant"]}>
      {children}
    </AuthGate>
  );
}
