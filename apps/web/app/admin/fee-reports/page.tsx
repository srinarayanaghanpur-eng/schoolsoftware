import { redirect } from "next/navigation";

// Fee reports were merged into the unified Reports page.
export default function FeeReportsPage() {
  redirect("/admin/reports");
}
