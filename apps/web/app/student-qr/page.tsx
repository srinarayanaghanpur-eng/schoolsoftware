type StudentQrDetails = {
  name?: unknown;
  fatherName?: unknown;
  motherName?: unknown;
  phone?: unknown;
  address?: unknown;
};

function decodeDetails(value?: string | string[]): StudentQrDetails | null {
  const encoded = Array.isArray(value) ? value[0] : value;
  if (!encoded) return null;

  try {
    const json = Buffer.from(encoded, "base64url").toString("utf8");
    const parsed = JSON.parse(json) as StudentQrDetails;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function text(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : "--";
}

export default function StudentQrPage({
  searchParams
}: {
  searchParams: { d?: string | string[] };
}) {
  const details = decodeDetails(searchParams.d);

  return (
    <main className="min-h-screen bg-[#f4f6ff] px-4 py-8 text-[#1b1d32]">
      <section className="mx-auto max-w-md overflow-hidden rounded-2xl border border-[#e2e6f4] bg-white shadow-[0_18px_48px_rgba(36,42,94,0.12)]">
        <div className="border-b border-[#edf0f7] bg-[#3033a1] px-5 py-5 text-white">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-white/70">Sri Narayana High School</p>
          <h1 className="mt-1 text-xl font-extrabold">Student Details</h1>
        </div>

        {details ? (
          <dl className="divide-y divide-[#edf0f7]">
            <div className="px-5 py-4">
              <dt className="text-xs font-bold uppercase tracking-wide text-[#7d86a8]">Name</dt>
              <dd className="mt-1 text-lg font-extrabold">{text(details.name)}</dd>
            </div>
            <div className="px-5 py-4">
              <dt className="text-xs font-bold uppercase tracking-wide text-[#7d86a8]">Father Name</dt>
              <dd className="mt-1 text-base font-bold">{text(details.fatherName)}</dd>
            </div>
            <div className="px-5 py-4">
              <dt className="text-xs font-bold uppercase tracking-wide text-[#7d86a8]">Mother Name</dt>
              <dd className="mt-1 text-base font-bold">{text(details.motherName)}</dd>
            </div>
            <div className="px-5 py-4">
              <dt className="text-xs font-bold uppercase tracking-wide text-[#7d86a8]">Phone No.</dt>
              <dd className="mt-1 text-base font-bold">{text(details.phone)}</dd>
            </div>
            <div className="px-5 py-4">
              <dt className="text-xs font-bold uppercase tracking-wide text-[#7d86a8]">Address</dt>
              <dd className="mt-1 whitespace-pre-wrap text-base font-bold leading-6">{text(details.address)}</dd>
            </div>
          </dl>
        ) : (
          <div className="px-5 py-8 text-center">
            <h2 className="text-lg font-extrabold">Invalid QR code</h2>
            <p className="mt-2 text-sm font-medium text-[#7d86a8]">
              This student QR code could not be read.
            </p>
          </div>
        )}
      </section>
    </main>
  );
}
