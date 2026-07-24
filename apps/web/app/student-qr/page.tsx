import { SCHOOL_CONTACT } from "@sri-narayana/shared";
import StudentDetailsReveal from "./StudentDetailsReveal";

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

const SCHOOL_NAME = SCHOOL_CONTACT.name;
const SCHOOL_LOGO_SRC = "/sri-narayana-high-school-logo.jpg";
const SCHOOL_ADDRESS = SCHOOL_CONTACT.address;
const SCHOOL_MOBILE = SCHOOL_CONTACT.phone;

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
          <div className="flex items-center gap-3">
            <span className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-xl bg-white p-1 shadow-lg shadow-black/10">
              <img
                src={SCHOOL_LOGO_SRC}
                alt={SCHOOL_NAME}
                className="h-full w-full object-cover"
              />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-extrabold uppercase tracking-[0.14em] leading-tight">
                {SCHOOL_NAME}
              </p>
              <p className="mt-1 text-[11px] font-medium leading-snug text-white/80">
                {SCHOOL_ADDRESS}
              </p>
              <p className="mt-0.5 text-[11px] font-semibold text-white/80">
                Mobile: {SCHOOL_MOBILE}
              </p>
            </div>
          </div>
          <h1 className="mt-4 text-xl font-extrabold">Student Details</h1>
        </div>

        {details ? (
          <StudentDetailsReveal
            details={{
              name: text(details.name),
              fatherName: text(details.fatherName),
              motherName: text(details.motherName),
              phone: text(details.phone),
              address: text(details.address)
            }}
          />
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
