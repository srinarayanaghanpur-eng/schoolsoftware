/** LEGACY ROUTE — superseded by /parent/messages (2026-07-21 rebuild). Delete during cleanup. */
import { Redirect } from "expo-router";
export default function LegacyMessages() { return <Redirect href={"/" as never} />; }
