import type { DigitalFeeReceiptRecord } from "@/lib/receiptService";
import { DigitalFeeReceipt } from "./DigitalFeeReceipt";

export function ReceiptA4Page({ receipt }: { receipt: DigitalFeeReceiptRecord }) {
  return (
    <>
      <div id="receipt-print-area" className="receipt-a4-page">
        <DigitalFeeReceipt receipt={receipt} />
        <div className="receipt-cut-line">CUT HERE</div>
        <DigitalFeeReceipt receipt={receipt} />
        <div className="receipt-cut-line">CUT HERE</div>
        <DigitalFeeReceipt receipt={receipt} />
      </div>
      <style jsx global>{`
        .receipt-a4-page {
          width: 210mm;
          min-height: 297mm;
          margin: 0 auto;
          background: #fff;
          padding: 8mm;
          color: #111827;
          box-sizing: border-box;
          font-family: Arial, Helvetica, sans-serif;
        }
        .digital-fee-receipt {
          height: 87mm;
          border: 1px solid #111827;
          padding: 4mm 5mm;
          box-sizing: border-box;
          font-size: 10.5px;
          line-height: 1.2;
          overflow: hidden;
        }
        .dfr-school {
          display: grid;
          grid-template-columns: 18mm 1fr 18mm;
          align-items: center;
          gap: 3mm;
          text-align: center;
        }
        .dfr-logo {
          width: 15mm;
          height: 15mm;
          object-fit: contain;
        }
        .dfr-school-text {
          grid-column: 2;
        }
        .dfr-school-text h1 {
          margin: 0;
          font-size: 16px;
          line-height: 1.05;
          font-weight: 900;
          letter-spacing: 0;
        }
        .dfr-school-text p {
          margin: 1px 0 0;
          font-size: 10.5px;
          font-weight: 700;
        }
        .dfr-school-text span {
          padding: 0 5px;
        }
        .dfr-title {
          margin-top: 2mm;
          border: 1px solid #111827;
          background: #eef2ff;
          padding: 1.2mm 2mm;
          text-align: center;
          font-size: 12px;
          font-weight: 900;
        }
        .dfr-top-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 3mm;
          margin-top: 2mm;
        }
        .dfr-top-grid div,
        .dfr-details div {
          display: grid;
          grid-template-columns: 24mm 1fr;
          align-items: center;
          min-height: 6mm;
          border: 1px solid #d1d5db;
          padding: 1mm 1.5mm;
        }
        .dfr-top-grid span,
        .dfr-details span {
          color: #374151;
          font-weight: 800;
        }
        .dfr-top-grid b,
        .dfr-details b {
          min-width: 0;
          overflow-wrap: anywhere;
          font-weight: 900;
        }
        .dfr-details {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1.5mm 3mm;
          margin-top: 1.5mm;
        }
        .dfr-fees {
          width: 100%;
          border-collapse: collapse;
          table-layout: fixed;
          margin-top: 2mm;
          font-size: 10px;
        }
        .dfr-fees th,
        .dfr-fees td {
          border: 1px solid #111827;
          padding: 1.2mm 1.5mm;
          text-align: left;
          vertical-align: middle;
          overflow-wrap: anywhere;
        }
        .dfr-fees th {
          background: #f3f4f6;
          font-weight: 900;
        }
        .dfr-fees th:nth-child(1) { width: 35%; }
        .dfr-fees th:nth-child(2) { width: 22%; }
        .dfr-fees th:nth-child(3) { width: 18%; }
        .dfr-fees th:nth-child(4) { width: 25%; }
        .dfr-amount {
          text-align: right !important;
          font-weight: 800;
        }
        .dfr-total {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 4mm;
          margin-top: 2mm;
          border: 1px solid #111827;
          padding: 1.5mm 2mm;
          font-weight: 900;
        }
        .dfr-total div {
          display: flex;
          gap: 4mm;
          align-items: baseline;
        }
        .dfr-total span {
          font-size: 11px;
        }
        .dfr-total b {
          font-size: 13px;
        }
        .dfr-total p {
          margin: 0;
          font-size: 11px;
        }
        .dfr-footer {
          display: flex;
          justify-content: space-between;
          gap: 4mm;
          margin-top: 1.6mm;
          color: #374151;
          font-size: 9.5px;
          font-weight: 700;
        }
        .receipt-cut-line {
          height: 8mm;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #4b5563;
          font-size: 10px;
          font-weight: 900;
          letter-spacing: 0;
          overflow: hidden;
        }
        .receipt-cut-line::before,
        .receipt-cut-line::after {
          content: "";
          flex: 1;
          border-top: 1px dashed #6b7280;
          margin: 0 3mm;
        }
        @media print {
          @page {
            size: A4 portrait;
            margin: 8mm;
          }
          body * {
            visibility: hidden;
          }
          #receipt-print-area,
          #receipt-print-area * {
            visibility: visible;
          }
          #receipt-print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            min-height: auto;
            margin: 0;
            padding: 0;
          }
          .no-print {
            display: none !important;
          }
          .receipt-a4-page {
            width: 100%;
          }
          .digital-fee-receipt {
            height: 87mm;
            break-inside: avoid;
            page-break-inside: avoid;
          }
          .dfr-title,
          .dfr-fees th {
            background: #fff;
          }
        }
      `}</style>
    </>
  );
}
