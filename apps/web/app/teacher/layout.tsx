import { AuthGate } from "@/components/AuthGate";

export default function TeacherLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGate role="teacher">
      <div className="page-enter">{children}</div>
    </AuthGate>
  );
}
