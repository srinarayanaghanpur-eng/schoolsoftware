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
  );
}
