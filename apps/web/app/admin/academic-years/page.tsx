import { redirect } from "next/navigation";

// Academic-year management moved under super_admin-only settings.
// Old bookmarks land here; send them to the new location (routeAccess still
// blocks non-super_admin roles there).
export default function AcademicYearsMovedPage() {
  redirect("/admin/settings/academic-years");
}
