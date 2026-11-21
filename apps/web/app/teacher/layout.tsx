import { AuthGate } from "@/components/AuthGate";
import { DarkModeToggle } from "@/components/DarkModeToggle";
import { TeacherNav } from "@/components/TeacherNav";

export default function TeacherLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGate role="teacher">
      <div className="erp-app min-h-screen bg-background text-foreground">
        <div className="sticky top-0 z-20 border-b border-border bg-card/95 px-4 py-2 backdrop-blur">
          <div className="mx-auto flex w-full max-w-[1440px] items-center gap-3">
            <span className="hidden shrink-0 text-xs font-extrabold tracking-[0.12em] text-[#777fc4] sm:block">
              TEACHER PORTAL
            </span>
            <TeacherNav />
            <div className="ml-auto shrink-0">
              <DarkModeToggle />
            </div>
          </div>
        </div>
        <div className="page-enter">{children}</div>
        <footer className="mt-6 border-t border-border px-4 py-4 text-center">
          <p className="text-xs font-medium text-muted-foreground">© 2026 Sri Narayana High School · Powered by NarayanaOS</p>
        </footer>
      </div>
    </AuthGate>
  );
}
