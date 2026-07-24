import type { DebitVoucher as DebitVoucherModel } from "@sri-narayana/shared";

type DebitVoucherProps = {
  voucher: DebitVoucherModel;
  className?: string;
  logoSrc?: string;
};

function formatDate(value: string) {
  if (!value) return "";
  const [year, month, day] = value.slice(0, 10).split("-");
  if (!year || !month || !day) return value;
  return `${day}-${month}-${year}`;
}

function formatAmount(value: number) {
  return (Number(value) || 0).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2
  });
}

function FieldLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="debit-voucher-field">
      <span>{label}</span>
      <strong>{value || " "}</strong>
    </div>
  );
}

function Signature({ label }: { label: string }) {
  return (
    <div className="debit-voucher-signature">
      <span />
      <p>{label}</p>
    </div>
  );
}

export function DebitVoucher({ voucher, className = "", logoSrc = "/sri-narayana-high-school-logo.jpg" }: DebitVoucherProps) {
  return (
    <article className={`debit-voucher ${className}`}>
      <header className="debit-voucher-header">
        <div className="debit-voucher-logo">
          <img src={logoSrc} alt="Sri Narayana High School" />
        </div>
        <div className="debit-voucher-school">
          <h2>Sri Narayana</h2>
          <h3>High School</h3>
          <p>Ghanpur (M), Jayashankar Bhupalpally</p>
        </div>
        <div className="debit-voucher-date">
          <span>Date</span>
          <strong>{formatDate(voucher.date)}</strong>
        </div>
      </header>

      <div className="debit-voucher-title">DEBIT VOUCHER</div>

      <div className="debit-voucher-serial">
        <span>SI.No.</span>
        <strong>{voucher.voucherNo}</strong>
      </div>

      <FieldLine label="Paid to" value={voucher.paidTo} />
      <FieldLine label="towards" value={voucher.towards} />
      <FieldLine label="in words" value={voucher.amountInWords} />

      <footer className="debit-voucher-footer">
        <div className="debit-voucher-amount">
          <span>₹</span>
          <strong>{formatAmount(voucher.amount)}</strong>
        </div>
        <Signature label="Signature of the Cashier" />
        <Signature label="Signature of the Chairman" />
        <Signature label="Signature of the Receiver" />
      </footer>
    </article>
  );
}
