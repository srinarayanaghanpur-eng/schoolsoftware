import type { DebitVoucher as DebitVoucherModel } from "@sri-narayana/shared";
import { DebitVoucher } from "./DebitVoucher";

type DebitVoucherA4PageProps = {
  vouchers: DebitVoucherModel[];
  copies?: number;
};

function chunk<T>(items: T[], size: number) {
  const pages: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    pages.push(items.slice(index, index + size));
  }
  return pages;
}

export function DebitVoucherA4Page({ vouchers, copies = 1 }: DebitVoucherA4PageProps) {
  const expanded = vouchers.length === 1 && copies > 1
    ? Array.from({ length: Math.min(Math.max(copies, 1), 4) }, () => vouchers[0])
    : vouchers;
  const pages = chunk(expanded, 4);

  return (
    <div id="voucher-print-area" className="debit-voucher-print-area">
      {pages.map((page, pageIndex) => (
        <section className="debit-voucher-a4-page" key={`${pageIndex}-${page.map((voucher) => voucher.id).join("-")}`}>
          {page.map((voucher, index) => (
            <DebitVoucher key={`${voucher.id ?? voucher.voucherNo}-${index}`} voucher={voucher} />
          ))}
          {Array.from({ length: 4 - page.length }).map((_, index) => (
            <div aria-hidden="true" className="debit-voucher-placeholder" key={`empty-${pageIndex}-${index}`} />
          ))}
        </section>
      ))}
    </div>
  );
}
