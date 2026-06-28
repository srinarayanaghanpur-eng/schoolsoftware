"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { Printer } from "lucide-react";
import { PaymentMethodBadge, FeeStatusBadge } from "@/components/FeeComponents";
import { auth } from "@sri-narayana/shared/firebase/client";

type ReceiptData = {
  receiptNo: string;
  schoolName: string;
  date: string;
  student: {
    id: string;
    name: string;
    admissionNo: string;
    className: string;
    section: string;
  } | null;
  amount: number;
  paymentType: string;
  paymentMethod: string;
  transactionId: string;
  status: string;
};

const NUMBER_WORDS: [number, string][] = [
  [10000000, "Crore"], [100000, "Lakh"], [1000, "Thousand"],
  [100, "Hundred"], [1, ""]
];

function amountInWords(amount: number): string {
  if (amount === 0) return "Zero Rupees";
  const words: string[] = [];
  let remaining = Math.round(amount);
  const paise = remaining % 100;
  remaining = Math.floor(remaining / 100) * 100;

  for (const [denom, label] of NUMBER_WORDS) {
    if (denom === 1) break;
    if (remaining >= denom) {
      const count = Math.floor(remaining / denom);
      words.push(`${count} ${label}`);
      remaining %= denom;
    }
  }
  if (remaining > 0) words.push(`${remaining}`);
  const result = words.join(" ") + " Rupees";
  if (paise > 0) {
    return `${result} and ${paise} Paise`;
  }
  return result;
}

export default function ReceiptPage() {
  const params = useParams();
  const paymentId = params?.paymentId as string;
  const [data, setData] = useState<ReceiptData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReceipt = useCallback(async () => {
    if (!paymentId) return;
    setLoading(true);
    setError(null);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(`/api/admin/finance/receipt/${paymentId}`, {
        headers: token ? { authorization: `Bearer ${token}` } : {},
      });
      const json = await res.json();
      if (json.ok) {
        setData(json.receipt);
      } else {
        setError(json.error || "Failed to load receipt");
      }
    } catch {
      setError("Unable to load receipt.");
    } finally {
      setLoading(false);
    }
  }, [paymentId]);

  useEffect(() => {
    fetchReceipt();
  }, [fetchReceipt]);

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f5f7fd]">
        <div className="text-sm font-semibold text-[#7d86a8]">Loading receipt...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f5f7fd]">
        <div className="card max-w-md p-8 text-center">
          <p className="text-sm font-semibold text-[#ed515d]">{error || "Receipt not found"}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f7fd] print:bg-white">
      <div className="mx-auto max-w-[600px] px-4 py-6 print:px-0 print:py-0">
        <div className="mb-4 hidden print:block" />

        <div className="card p-8 print:border-0 print:shadow-none">
          <div className="text-center">
            <h1 className="text-xl font-extrabold text-[#1b1d32]">{data.schoolName}</h1>
            <p className="mt-1 text-sm font-medium text-[#7d86a8]">Fee Payment Receipt</p>
          </div>

          <div className="mt-6 flex items-center justify-between border-b border-[#edf0f7] pb-3 text-sm">
            <div>
              <span className="font-semibold text-[#7d86a8]">Receipt No:</span>
              <span className="ml-2 font-bold text-[#1f2136]">{data.receiptNo}</span>
            </div>
            <div>
              <span className="font-semibold text-[#7d86a8]">Date:</span>
              <span className="ml-2 font-bold text-[#1f2136]">{data.date}</span>
            </div>
          </div>

          {data.student && (
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="font-semibold text-[#7d86a8]">Student Name</p>
                <p className="font-bold text-[#1f2136]">{data.student.name}</p>
              </div>
              <div>
                <p className="font-semibold text-[#7d86a8]">Admission No</p>
                <p className="font-bold text-[#1f2136]">{data.student.admissionNo}</p>
              </div>
              <div>
                <p className="font-semibold text-[#7d86a8]">Class</p>
                <p className="font-bold text-[#1f2136]">{data.student.className}</p>
              </div>
              <div>
                <p className="font-semibold text-[#7d86a8]">Section</p>
                <p className="font-bold text-[#1f2136]">{data.student.section || "--"}</p>
              </div>
            </div>
          )}

          <div className="mt-5 border-t border-[#edf0f7] pt-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#edf0f7]">
                  <th className="pb-2 text-left font-bold text-[#7d86a8]">Description</th>
                  <th className="pb-2 text-right font-bold text-[#7d86a8]">Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="py-2 font-semibold text-[#1f2136] capitalize">{data.paymentType} Fee</td>
                  <td className="py-2 text-right font-extrabold text-[#13a961]">₹{data.amount.toLocaleString("en-IN")}</td>
                </tr>
              </tbody>
              <tfoot>
                <tr className="border-t border-[#edf0f7]">
                  <td className="py-2 font-bold text-[#1f2136]">Total</td>
                  <td className="py-2 text-right font-extrabold text-[#13a961]">₹{data.amount.toLocaleString("en-IN")}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="mt-3 text-sm font-semibold text-[#303247]">
            <p>Amount in words: <span className="font-bold text-[#13a961]">{amountInWords(data.amount)}</span></p>
          </div>

          <div className="mt-4 flex flex-wrap gap-4 border-t border-[#edf0f7] pt-4 text-sm">
            <div>
              <span className="font-semibold text-[#7d86a8]">Payment Method: </span>
              <PaymentMethodBadge method={data.paymentMethod as any} />
            </div>
            {data.transactionId && (
              <div>
                <span className="font-semibold text-[#7d86a8]">Transaction ID: </span>
                <span className="font-bold text-[#1f2136]">{data.transactionId}</span>
              </div>
            )}
            <div>
              <span className="font-semibold text-[#7d86a8]">Status: </span>
              <FeeStatusBadge status={data.status as any} size="sm" />
            </div>
          </div>

          <div className="mt-8 flex items-end justify-between border-t border-[#edf0f7] pt-6 text-sm">
            <div className="text-center">
              <div className="border-t border-[#1b1d32] pt-1">
                <p className="font-bold text-[#1f2136]">Authorized Signature</p>
              </div>
            </div>
            <div className="text-right text-xs font-medium text-[#7d86a8]">
              <p>This is a computer-generated receipt.</p>
            </div>
          </div>
        </div>

        <div className="mt-4 flex justify-center print:hidden">
          <button onClick={handlePrint} className="btn-primary">
            <Printer size={18} />
            Print Receipt
          </button>
        </div>
      </div>
    </div>
  );
}
