import type { DigitalFeeReceiptRecord } from "@/lib/receiptService";

function formatINR(value: number) {
  return `Rs. ${Number(value || 0).toLocaleString("en-IN")}`;
}

function formatDate(value: string) {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);
  return date.toLocaleDateString("en-GB");
}

function formatPrinted(value: string | undefined, username: string) {
  const date = value ? new Date(value) : new Date();
  const valid = Number.isNaN(date.getTime()) ? new Date() : date;
  const time = valid.toLocaleTimeString("en-GB", { hour12: false });
  return `${username || "USER"}-${time} ${valid.toLocaleDateString("en-GB")}`;
}

export function DigitalFeeReceipt({ receipt }: { receipt: DigitalFeeReceiptRecord }) {
  const classSection = [receipt.className, receipt.section].filter(Boolean).join(" / ") || "--";

  return (
    <article className="digital-fee-receipt">
      <header className="dfr-school">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/sri-narayana-high-school-logo.jpg" alt="Sri Narayana High School logo" className="dfr-logo" />
        <div className="dfr-school-text">
          <h1>SRI NARAYANA HIGH SCHOOL</h1>
          <p>Ghanpur (M), Jayashankar Bhupalpally District</p>
          <p>Phone: 6300038389 <span>|</span> Academic Year: {receipt.academicYear}</p>
        </div>
      </header>

      <div className="dfr-title">DIGITAL FEE RECEIPT</div>

      <section className="dfr-top-grid">
        <div>
          <span>Receipt No.</span>
          <b>{receipt.receiptNo}</b>
        </div>
        <div>
          <span>Date</span>
          <b>{formatDate(receipt.paymentDate)}</b>
        </div>
      </section>

      <section className="dfr-details">
        <div><span>Student Name</span><b>{receipt.studentName || "--"}</b></div>
        <div><span>Class / Sec</span><b>{classSection}</b></div>
        <div><span>Parent Name</span><b>{receipt.parentName || "--"}</b></div>
        <div><span>Mobile</span><b>{receipt.mobile || "--"}</b></div>
        <div><span>Admission No.</span><b>{receipt.admissionNo || "--"}</b></div>
        <div><span>Mode</span><b>{receipt.paymentMode || "--"}</b></div>
      </section>

      <table className="dfr-fees">
        <thead>
          <tr>
            <th>Particulars</th>
            <th>Period / Month</th>
            <th>Amount (Rs.)</th>
            <th>Remarks</th>
          </tr>
        </thead>
        <tbody>
          {receipt.feeItems.map((item) => (
            <tr key={item.type}>
              <td>{item.type}</td>
              <td>{item.periodOrMonth || "--"}</td>
              <td className="dfr-amount">{item.amount > 0 ? item.amount.toLocaleString("en-IN") : "--"}</td>
              <td>{item.remarks || "--"}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <section className="dfr-total">
        <div>
          <span>TOTAL PAID</span>
          <b>{formatINR(receipt.totalPaid)}</b>
        </div>
        <p>Balance Due: {formatINR(receipt.balanceDue)}</p>
      </section>

      <footer className="dfr-footer">
        <span>Computer-generated receipt</span>
        <span>Printed: {formatPrinted(receipt.printedAt, receipt.createdByUsername)}</span>
      </footer>
    </article>
  );
}
