import { redirect } from "next/navigation";

export default function DebitVouchersRedirect() {
  redirect("/admin/finance/expenses");
}
