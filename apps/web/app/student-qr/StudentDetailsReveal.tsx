"use client";

import { useState } from "react";

export type StudentDetailsView = {
  name: string;
  fatherName: string;
  motherName: string;
  phone: string;
  address: string;
};

const ROWS: Array<{ label: string; key: keyof StudentDetailsView; big?: boolean; multiline?: boolean }> = [
  { label: "Name", key: "name", big: true },
  { label: "Father Name", key: "fatherName" },
  { label: "Mother Name", key: "motherName" },
  { label: "Phone No.", key: "phone" },
  { label: "Address", key: "address", multiline: true }
];

export default function StudentDetailsReveal({ details }: { details: StudentDetailsView }) {
  const [revealed, setRevealed] = useState(false);
  // OK wipe: details live only in this component's memory while shown. OK
  // clears them AND strips the encoded data from the address bar, so nothing
  // remains on the phone — no storage, no history entry with data. Scanning
  // the QR again loads a fresh copy.
  const [dismissed, setDismissed] = useState(false);

  const handleOk = () => {
    setDismissed(true);
    setRevealed(false);
    try {
      const url = new URL(window.location.href);
      url.search = "";
      window.history.replaceState(null, "", url.toString());
    } catch { /* ignore */ }
  };

  if (dismissed) {
    return (
      <div className="px-5 py-10 text-center">
        <p className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[#e6f8ef] text-2xl font-extrabold text-[#0f8d52]">
          OK
        </p>
        <h2 className="mt-4 text-lg font-extrabold">Details removed</h2>
        <p className="mx-auto mt-2 max-w-xs text-sm font-medium text-[#7d86a8]">
          The student details have been cleared from this phone. Scan the QR code again if you need to view them.
        </p>
      </div>
    );
  }

  if (!revealed) {
    return (
      <div className="px-5 py-8 text-center">
        <p className="text-sm font-medium text-[#7d86a8]">
          Tap below to view this student&apos;s details.
        </p>
        <button
          type="button"
          onClick={() => setRevealed(true)}
          className="mt-4 w-full rounded-xl bg-[#3033a1] px-5 py-3 text-sm font-extrabold uppercase tracking-wide text-white shadow-[0_10px_24px_rgba(48,51,161,0.28)] transition hover:bg-[#272a8c]"
        >
          View Student Details
        </button>
      </div>
    );
  }

  return (
    <>
      <dl className="divide-y divide-[#edf0f7]">
      {ROWS.map((row) => (
        <div key={row.key} className="px-5 py-4">
          <dt className="text-xs font-bold uppercase tracking-wide text-[#7d86a8]">{row.label}</dt>
          <dd
            className={
              row.big
                ? "mt-1 text-lg font-extrabold"
                : row.multiline
                  ? "mt-1 whitespace-pre-wrap text-base font-bold leading-6"
                  : "mt-1 text-base font-bold"
            }
          >
            {details[row.key]}
          </dd>
        </div>
      ))}
      </dl>
      <div className="px-5 pb-6">
        <button
          type="button"
          onClick={handleOk}
          className="w-full rounded-xl bg-[#0f8d52] px-5 py-3.5 text-sm font-extrabold uppercase tracking-wide text-white shadow-[0_10px_24px_rgba(15,141,82,0.28)] transition hover:bg-[#0c7343]"
        >
          OK — Remove from this phone
        </button>
        <p className="mt-2 text-center text-xs font-medium text-[#7d86a8]">
          Tapping OK clears these details from this phone immediately.
        </p>
      </div>
    </>
  );
}
