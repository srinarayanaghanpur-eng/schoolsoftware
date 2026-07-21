/** LEGACY ROUTE — superseded by /parent/profile (2026-07-21 rebuild). Delete during cleanup. */
import { Redirect } from "expo-router";
export default function LegacyProfile() { return <Redirect href={"/" as never} />; }
