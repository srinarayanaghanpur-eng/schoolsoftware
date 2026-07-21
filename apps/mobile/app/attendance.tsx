/**
 * LEGACY ROUTE — old UI removed (2026-07-21 rebuild). Delete during cleanup.
 * The GPS attendance business flow was preserved: the teardown script extracts
 * it to lib/attendance/useAttendanceMarking.ts for the future teacher workspace.
 */
import { Redirect } from "expo-router";
export default function LegacyAttendance() { return <Redirect href={"/" as never} />; }
