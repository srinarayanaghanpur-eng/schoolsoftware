/** LEGACY ROUTE — fee details now live on /parent home + profile (2026-07-21 rebuild). Delete during cleanup. */
import { Redirect } from "expo-router";
export default function LegacyFees() { return <Redirect href={"/" as never} />; }
