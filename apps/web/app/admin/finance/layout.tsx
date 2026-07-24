// Finance access is enforced by the parent /admin AuthGate through the central
// route table. Keeping a second nested guard here causes duplicate redirects.
export default function FinanceLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
