"use client";

import type { SalaryReport } from "@sri-narayana/shared";
import { Printer, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

const ONES = [
  "",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
  "Eleven",
  "Twelve",
  "Thirteen",
  "Fourteen",
  "Fifteen",
  "Sixteen",
  "Seventeen",
  "Eighteen",
  "Nineteen"
];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function twoDigits(value: number): string {
  if (value < 20) return ONES[value];
  const tens = Math.floor(value / 10);
  const ones = value % 10;
  return `${TENS[tens]}${ones ? ` ${ONES[ones]}` : ""}`;
}

function numberToWords(value: number): string {
  let n = Math.round(Math.abs(value));
  if (n === 0) return "Zero";
  const parts: string[] = [];
  const crore = Math.floor(n / 10000000);
  n %= 10000000;
  const lakh = Math.floor(n / 100000);
  n %= 100000;
  const thousand = Math.floor(n / 1000);
  n %= 1000;
  const hundred = Math.floor(n / 100);
  n %= 100;
  if (crore) parts.push(`${numberToWords(crore)} Crore`);
  if (lakh) parts.push(`${twoDigits(lakh)} Lakh`);
  if (thousand) parts.push(`${twoDigits(thousand)} Thousand`);
  if (hundred) parts.push(`${ONES[hundred]} Hundred`);
  if (n) parts.push(twoDigits(n));
  return parts.join(" ");
}

function amount(value?: number): string {
  return (value ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

export function SalarySlipPrint({
  report,
  monthLabel,
  onClose
}: {
  report: SalaryReport;
  monthLabel: string;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const figures = useMemo(() => {
    const basic = report.baseSalary || 0;
    const allowances = report.bonus || 0;
    const gross = basic + allowances;
    const net = Math.max(0, report.netPayable || 0);
    const deduction = Math.max(0, gross - net);
    const advance = 0;
    const leave = Math.min(report.salaryDeduction || 0, deduction);
    const other = Math.max(0, deduction - leave - advance);
    return { basic, allowances, leave, advance, other, gross, deduction, net };
  }, [report]);

  if (!mounted) return null;

  const workingDays = report.totalWorkingDaysInMonth ?? report.workingDays;

  return createPortal(
    <div className="slip-overlay">
      <div className="slip-bar">
        <button type="button" className="slip-btn slip-btn-ghost" onClick={onClose}>
          <X size={14} /> Close
        </button>
        <span className="slip-bar-info">Payslip · {monthLabel}</span>
        <button type="button" className="slip-btn" onClick={() => window.print()}>
          <Printer size={14} /> Print
        </button>
      </div>

      <div className="slip-wrap">
        <div className="slip-page">
          <div className="slip-head">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/certificate-logo.png" alt="School logo" />
            <div className="slip-head-text">
              <h1>SRI NARAYANA HIGH SCHOOL</h1>
              <p>Ghanpur, Jayashankar Bhupalpally, Telangana</p>
            </div>
          </div>

          <h3>
            PAYSLIP – <span>{monthLabel}</span>
          </h3>

          <div className="slip-grid">
            <div>
              Name: <b>{report.teacherName || "—"}</b>
            </div>
            <div>
              Employee ID: <b>{report.employeeId || "—"}</b>
            </div>
            <div>
              Designation: <b>{report.subject || "Staff"}</b>
            </div>
            <div>
              Working Days / Days Present: <b>{workingDays} / {report.presentDays}</b>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Earnings</th>
                <th className="r">Amount (₹)</th>
                <th>Deductions</th>
                <th className="r">Amount (₹)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Basic Salary</td>
                <td className="r">{amount(figures.basic)}</td>
                <td>Leave Deduction</td>
                <td className="r">{amount(figures.leave)}</td>
              </tr>
              <tr>
                <td>Allowances</td>
                <td className="r">{amount(figures.allowances)}</td>
                <td>Advance Recovery</td>
                <td className="r">{amount(figures.advance)}</td>
              </tr>
              <tr>
                <td>&nbsp;</td>
                <td />
                <td>Other Deductions</td>
                <td className="r">{amount(figures.other)}</td>
              </tr>
              <tr className="b">
                <td>Gross Salary</td>
                <td className="r">{amount(figures.gross)}</td>
                <td>Total Deductions</td>
                <td className="r">{amount(figures.deduction)}</td>
              </tr>
              <tr className="b">
                <td colSpan={3}>NET SALARY</td>
                <td className="r">{amount(figures.net)}</td>
              </tr>
            </tbody>
          </table>

          <p className="slip-words">
            Amount in words: <b>{numberToWords(figures.net)} Rupees Only</b>
          </p>

          <div className="slip-sign">
            <div>Employee Signature</div>
            <div>Authorised Signatory</div>
          </div>
        </div>
      </div>

      <style>{`
        .slip-overlay { position: fixed; inset: 0; z-index: 100; background: #e9ecf3; overflow: auto; font-family: Arial, Helvetica, sans-serif; color: #000; }
        .slip-bar { display: flex; align-items: center; justify-content: center; gap: 12px; flex-wrap: wrap; padding: 12px; background: #fff; color: #222; font: 14px system-ui, sans-serif; position: sticky; top: 0; z-index: 2; box-shadow: 0 1px 4px rgba(0,0,0,.08); }
        .slip-bar-info { font-weight: 700; }
        .slip-btn { display: inline-flex; align-items: center; gap: 6px; font-size: 14px; padding: 8px 14px; border-radius: 8px; border: 0; background: #222; color: #fff; cursor: pointer; }
        .slip-btn-ghost { background: #eef0f7; color: #222; }
        .slip-wrap { overflow-x: auto; padding: 20px 12px; }
        .slip-page { width: 210mm; min-height: 148mm; margin: 0 auto; background: #fff; padding: 12mm 14mm; font-size: 11.5pt; box-sizing: border-box; }
        .slip-head { display: flex; align-items: center; gap: 6mm; border-bottom: 2px solid #000; padding-bottom: 3mm; }
        .slip-head img { width: 18mm; height: 18mm; object-fit: contain; }
        .slip-head-text { flex: 1; text-align: center; }
        .slip-head-text h1 { margin: 0; font-size: 17pt; letter-spacing: .5pt; }
        .slip-head-text p { margin: 1mm 0 0; font-size: 11pt; }
        .slip-page h3 { text-align: center; margin: 4mm 0 3mm; font-size: 13pt; }
        .slip-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5mm 8mm; margin-bottom: 4mm; }
        .slip-page table { width: 100%; border-collapse: collapse; }
        .slip-page th, .slip-page td { border: 1px solid #000; padding: 2mm 3mm; text-align: left; }
        .slip-page .r { text-align: right; }
        .slip-page .b td, .slip-page .b th { font-weight: 700; }
        .slip-words { margin: 3mm 0 0; }
        .slip-sign { margin-top: 18mm; display: flex; justify-content: space-between; }
        .slip-sign div { text-align: center; min-width: 55mm; border-top: 1px solid #000; padding-top: 1.5mm; }
        @page { size: 210mm 148mm; margin: 0; }
        @media print {
          body { background: #fff; }
          body * { visibility: hidden; }
          .slip-overlay { position: static; background: none; }
          .slip-overlay, .slip-overlay * { visibility: visible; }
          .slip-bar { display: none; }
          .slip-wrap { padding: 0; overflow: visible; }
          .slip-page { position: fixed; left: 0; top: 0; margin: 0; }
        }
      `}</style>
    </div>,
    document.body
  );
}
