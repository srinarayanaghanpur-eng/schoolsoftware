"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

/** School default UPI payee, used until/unless overridden in admin Settings. */
export const DEFAULT_UPI_ID = "6300629537-t87a@ybl";
export const DEFAULT_UPI_PAYEE_NAME = "SRI NARAYANA HIGH SCHOOL";

/** Builds a standard UPI deep-link that any UPI app (PhonePe, GPay, Paytm) can scan. */
export function buildUpiUri({ upiId, payeeName, amount, note }: { upiId: string; payeeName: string; amount?: number; note?: string }) {
  const params = new URLSearchParams();
  params.set("pa", upiId);
  params.set("pn", payeeName);
  params.set("cu", "INR");
  if (amount && amount > 0) params.set("am", amount.toFixed(2));
  if (note) params.set("tn", note);
  return `upi://pay?${params.toString()}`;
}

/** Renders a scannable QR for a UPI payment of the given amount. */
export function UpiQr({ upiId, payeeName, amount, note, size = 200 }: { upiId: string; payeeName: string; amount?: number; note?: string; size?: number }) {
  const [dataUrl, setDataUrl] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!upiId || !payeeName) return;
    const uri = buildUpiUri({ upiId, payeeName, amount, note });
    QRCode.toDataURL(uri, { width: size, margin: 1, errorCorrectionLevel: "M" })
      .then(setDataUrl)
      .catch(() => setError("Could not generate QR."));
  }, [upiId, payeeName, amount, note, size]);

  if (!upiId || !payeeName) {
    return <p className="text-xs font-medium text-[#7d86a8]">Set the school UPI ID in Settings to show a payment QR.</p>;
  }
  if (error) return <p className="text-xs font-semibold text-[#ed515d]">{error}</p>;

  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <div className="rounded-2xl border border-[#e3e6f0] bg-white p-3 shadow-sm">
        {dataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={dataUrl} alt="UPI payment QR" width={size} height={size} />
        ) : (
          <div style={{ width: size, height: size }} className="grid place-items-center text-xs text-[#7d86a8]">Generating…</div>
        )}
      </div>
      <div>
        {amount && amount > 0 ? (
          <p className="text-sm font-extrabold text-[#14a762]">Scan to pay ₹{amount.toLocaleString("en-IN")}</p>
        ) : (
          <p className="text-xs font-medium text-[#7d86a8]">Enter an amount to lock it into the QR</p>
        )}
        <p className="text-xs font-semibold text-[#303247]">{payeeName}</p>
        <p className="text-[11px] font-medium text-[#7d86a8]">{upiId}</p>
      </div>
    </div>
  );
}
