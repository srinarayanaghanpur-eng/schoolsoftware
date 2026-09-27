import { AuthGate } from "@/components/AuthGate";
import { DarkModeToggle } from "@/components/DarkModeToggle";

export default function TeacherLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGate role="teacher">
      <div className="erp-app min-h-screen bg-background text-foreground">
        <div className="sticky top-0 z-20 flex items-center justify-end border-b border-border bg-card/95 px-4 py-2 backdrop-blur">
          <DarkModeToggle />
        </div>
        <div className="page-enter">{children}</div>
        <footer className="mt-6 border-t border-border px-4 py-4 text-center">
          <p className="text-xs font-medium text-muted-foreground">© 2026 Sri Narayana High School · Powered by NarayanaOS</p>
        </footer>
      </div>
    </AuthGate>
  );
}
