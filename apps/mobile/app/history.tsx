/** Legacy flat route — kept so old deep links keep working. Redirects to the rebuilt workspace. */
import { Redirect } from "expo-router";
export default function LegacyHistory() { return <Redirect href={"/teacher/history" as never} />; }
