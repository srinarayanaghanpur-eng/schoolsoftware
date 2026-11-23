"use client";

import { Download, Printer, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import QRCode from "qrcode";
import { adminApiRequest, AdminApiError } from "@/lib/adminApiClient";
import { getDesktopBridge, printCurrentPage, savePagePdf } from "@/lib/desktopBridge";

const CERT_TITLES: Record<string, string> = {
  transfer: "Transfer Certificate",
  character: "Character Certificate",
  bonafide: "Bonafide Certificate",
  conduct: "Conduct Certificate",
  general: "General Certificate",
  studyConductDob: "Study, Conduct & Date of Birth Certificate"
};

const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
const ORD = ["", "First", "Second", "Third", "Fourth", "Fifth", "Sixth", "Seventh", "Eighth", "Ninth", "Tenth", "Eleventh", "Twelfth", "Thirteenth", "Fourteenth", "Fifteenth", "Sixteenth", "Seventeenth", "Eighteenth", "Nineteenth"];
const MON = ["", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const smallWords = (n: number) => (n < 20 ? ONES[n] : `${TENS[Math.floor(n / 10)]}${n % 10 ? ` ${ONES[n % 10]}` : ""}`);
const ordinalDay = (d: number) =>
  d < 20 ? ORD[d] : d === 20 ? "Twentieth" : d < 30 ? `Twenty ${ORD[d - 20]}` : d === 30 ? "Thirtieth" : `Thirty ${ORD[d - 30]}`;
const yearWords = (y: number) =>
  y >= 2000 ? `Two Thousand${y % 100 ? ` ${smallWords(y % 100)}` : ""}` : `${smallWords(Math.floor(y / 100))} ${y % 100 ? smallWords(y % 100) : "Hundred"}`;

function dobToWords(dmy: string): string {
  const [d, m, y] = dmy.split("-").map(Number);
  if (!d || !m || !y) return "";
  return `${ordinalDay(d)} ${MON[m]} ${yearWords(y)}`;
}

function formatDMY(raw: string): string {
  const value = String(raw || "").trim();
  if (!value) return "";
  const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[3]}-${iso[2]}-${iso[1]}`;
  const dmy = value.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (dmy) return `${dmy[1].padStart(2, "0")}-${dmy[2].padStart(2, "0")}-${dmy[3]}`;
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) {
    return `${String(parsed.getDate()).padStart(2, "0")}-${String(parsed.getMonth() + 1).padStart(2, "0")}-${parsed.getFullYear()}`;
  }
  return value;
}

function classLabel(raw: string): string {
  const value = String(raw || "").trim();
  if (!value) return "";
  const n = parseInt(value, 10);
  if (!Number.isFinite(n)) return value;
  const suffix = n % 100 >= 11 && n % 100 <= 13 ? "th" : n % 10 === 1 ? "st" : n % 10 === 2 ? "nd" : n % 10 === 3 ? "rd" : "th";
  return `${n}${suffix} Class`;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : value === undefined || value === null ? "" : String(value).trim();
}

export function CertificatePrintView({
  student,
  certificate,
  manual = false
}: {
  student: Record<string, unknown>;
  certificate: Record<string, unknown>;
  manual?: boolean;
}) {
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [duplicate, setDuplicate] = useState(false);
  const [busy, setBusy] = useState(false);
  const [consumeError, setConsumeError] = useState("");
  const [mounted, setMounted] = useState(false);
  const [desktopPdf, setDesktopPdf] = useState(false);
  const exitRef = useRef(false);
  const consumedRef = useRef(false);

  useEffect(() => {
    setMounted(true);
    setDesktopPdf(Boolean(getDesktopBridge()?.print?.pdf));
  }, []);

  const certData = useMemo(() => {
    const raw = certificate.data;
    if (typeof raw === "string") {
      try {
        return asRecord(JSON.parse(raw)) as Record<string, string>;
      } catch {
        return {} as Record<string, string>;
      }
    }
    return asRecord(raw) as Record<string, string>;
  }, [certificate.data]);

  const certificateId = asString(certificate.id);
  const certificateNumber = asString(certificate.certificateNumber);
  const certificateType = asString(certificate.certificateType);
  const title = manual ? "Study, Conduct & Date of Birth Certificate" : CERT_TITLES[certificateType] || "Certificate";
  const studentId = asString(certificate.studentId) || asString(student.id);
  const backHref = studentId ? `/admin/student/${studentId}?tab=certificates` : "/admin/certificates";

  const pick = (dataKey: string, studentKeys: string[], fallback = "") => {
    const fromData = asString(certData[dataKey]);
    if (fromData) return fromData;
    for (const key of studentKeys) {
      const value = asString(student[key]);
      if (value) return value;
    }
    return fallback;
  };

  const name = pick("studentName", ["studentName", "name"], asString(certificate.studentName));
  const admissionNumber = pick("admissionNumber", ["admissionNumber", "admissionNo"]);
  const rollNo = pick("rollNo", ["rollNumber", "rollNo", "roll"]);
  const className = pick("className", ["class", "className"], asString(certificate.className));
  const section = pick("section", ["section"], asString(certificate.section));
  const dateOfBirth = formatDMY(pick("dateOfBirth", ["dateOfBirth", "dob"]));
  const admissionDate = formatDMY(pick("admissionDate", ["admissionDate", "createdAt"]));
  const gender = pick("gender", ["gender"]);
  const fatherName = pick("fatherName", ["fatherName"]);
  const motherName = pick("motherName", ["motherName"]);
  const previousClass = pick("previousSchoolLastClass", ["previousSchoolLastClass"]);

  const isFemale = /^(f|female|girl)/i.test(gender);
  const prefix = isFemale ? "Kumari" : "Kumar";
  const prefixShort = isFemale ? "Miss" : "Master";
  const pronounSubject = isFemale ? "She" : "He";
  const pronounPossessive = isFemale ? "her" : "his";
  const relation = isFemale ? "D/o." : "S/o.";
  const possessiveCap = isFemale ? "Her" : "His";
  const parentTitle = pick("parentTitle", [], "Sri");
  const parent = fatherName || motherName;
  const conduct = pick("conduct", [], "Good");
  const year = pick("academicYear", ["academicYear", "academicYearName"]) || asString(certificate.academicYearId);
  const yearStart = (year.match(/20\d{2}/)?.[0] || "").trim();
  const admissionYear = admissionDate.split("-")[2] || yearStart;
  const studiedTo = pick("studiedTo", [], classLabel(className));
  const studiedFrom = pick("studiedFrom", [], previousClass ? classLabel(previousClass) : "1st Class");
  const yearFrom = pick("yearFrom", [], admissionYear);
  const yearTo = pick("yearTo", [], yearStart);
  const prevYear = pick("prevYear", [], "");
  const dobWords = pick("dobWords", [], dobToWords(dateOfBirth));
  const issueDate = formatDMY(asString(certificate.issueDate));
  const place = pick("place", [], "Ghanpur");
  const classSection = section ? `Class ${className}-${section}` : `Class ${className}`;

  const tcNo = pick("tcNo", [], certificateNumber);
  const nationality = pick("nationality", ["nationality"], "Indian");
  const religion = pick("religion", ["religion"], "");
  const category = pick("category", ["category", "caste"], "");
  const firstAdmission = pick(
    "firstAdmission",
    [],
    [admissionDate, classLabel(className)].filter(Boolean).join(", ")
  );
  const lastClass = pick("lastClass", [], classLabel(className));
  const lastExam = pick("lastExam", [], year ? `Annual Examination ${year} – Passed` : "");
  const failed = pick("failed", [], "No");
  const subjects = pick("subjects", ["subjects"], "Telugu, Hindi, English, Maths, Science, Social");
  const promotion = pick("promotion", [], "");
  const duesMonth = pick("duesMonth", [], "");
  const concession = pick("concession", [], "Nil");
  const appliedDate = formatDMY(pick("appliedDate", [], asString(certificate.issueDate)));
  const issuedDate = formatDMY(pick("issuedDate", [], asString(certificate.issueDate)));
  const daysTotal = pick("daysTotal", [], "");
  const daysAttended = pick("daysAttended", [], "");

  const closeViewer = useCallback(() => {
    if (exitRef.current) return;
    exitRef.current = true;
    window.close();
    window.setTimeout(() => {
      if (!window.closed) window.location.replace(backHref);
    }, 200);
  }, [backHref]);

  const consumePrint = useCallback(async () => {
    if (manual || !certificateId || consumedRef.current) return;
    consumedRef.current = true;
    try {
      await adminApiRequest(`/api/admin/certificates/${encodeURIComponent(certificateId)}/print`, {
        method: "POST"
      });
      try {
        window.localStorage.setItem(
          "sriNarayana.certificatePrinted",
          JSON.stringify({ certificateId, at: Date.now() })
        );
      } catch {
        // Cross-tab refresh is a convenience; ignore storage failures.
      }
    } catch (error) {
      consumedRef.current = false;
      throw error;
    }
  }, [manual, certificateId]);

  useEffect(() => {
    const onAfterPrint = () => {
      void (async () => {
        try {
          await consumePrint();
        } catch {
          // Closing after printing is the required outcome even if the
          // server-side consume call cannot be confirmed.
        }
        closeViewer();
      })();
    };
    window.addEventListener("afterprint", onAfterPrint);
    return () => window.removeEventListener("afterprint", onAfterPrint);
  }, [closeViewer, consumePrint]);

  const handlePrint = async () => {
    if (busy) return;
    setBusy(true);
    setConsumeError("");
    try {
      await consumePrint();
      const printed = await printCurrentPage();
      if (printed.native) closeViewer();
    } catch (err) {
      setConsumeError(
        err instanceof AdminApiError ? err.message : "Could not prepare this certificate for printing. Please try again."
      );
    } finally {
      setBusy(false);
    }
  };

  const handlePdf = async () => {
    if (busy) return;
    setBusy(true);
    setConsumeError("");
    try {
      const result = await savePagePdf(`${certificateNumber || "certificate"}.pdf`);
      if (!result) return;
      if (!result.ok) {
        if (!result.canceled) setConsumeError(result.error || "Could not save the PDF.");
        return;
      }
      try {
        await consumePrint();
      } catch {
        // The PDF was saved; close even if the consume call cannot be confirmed.
      }
      closeViewer();
    } finally {
      setBusy(false);
    }
  };

  const handleCancel = () => {
    if (busy) return;
    // Closing without printing must not consume the one-time print link.
    closeViewer();
  };

  const verifyUrl = useMemo(() => {
    if (manual || !certificateNumber || typeof window === "undefined") return "";
    return `${window.location.origin}/verify/${certificateNumber.split("/").map(encodeURIComponent).join("/")}`;
  }, [certificateNumber, manual]);

  useEffect(() => {
    let cancelled = false;
    if (!verifyUrl) {
      setQrDataUrl("");
      return () => {
        cancelled = true;
      };
    }
    QRCode.toDataURL(verifyUrl, { margin: 0, width: 180, errorCorrectionLevel: "M" })
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setQrDataUrl("");
      });
    return () => {
      cancelled = true;
    };
  }, [verifyUrl]);

  const isBonafide = certificateType === "bonafide";
  const isStudyDob = certificateType === "studyConductDob";
  const isTransfer = certificateType === "transfer";

  const header = (
    <div className="cert-head">
      <div className="cert-logo">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/certificate-logo.png" alt="School logo" />
      </div>
      <div className="cert-titleblock">
        <h1>Sri Narayana High School</h1>
        <p>
          <b>(Nursery to 10th) English Medium School</b>
        </p>
        <p>Village &amp; Mandal : Ghanpur, Dist : Jayashankar Bhupalpally, T.S. &nbsp;Cell : 6300038389</p>
      </div>
      {manual ? (
        <div className="cert-qrslot" aria-hidden="true" />
      ) : (
        <div className="cert-qrslot">
          {qrDataUrl ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrDataUrl} alt={`Verify ${certificateNumber}`} />
              <div className="cert-qrcaption">Scan to verify</div>
            </>
          ) : null}
        </div>
      )}
    </div>
  );

  const footer = (
    <div className="cert-foot">
      <div>Admn. In-charge</div>
      <div className="cert-foot-center">
        {manual ? (
          "Sri Narayana High School, Ghanpur (M)"
        ) : (
          <>
            SRI NARAYANA HIGH SCHOOL, Ghanpur (M)
            <br />
            DEO, Jayashankar Bhupalpally
            <br />
            RC. No. 1117/A1/2021 Dt. 03-11-2021
            <br />
            RJDSE Warangal, Telangana.
            <br />
            RC. No. JSK GHNM-003-0003 Dt. 11-01-2022
          </>
        )}
      </div>
      <div>Head Master</div>
    </div>
  );

  const metaRows = (
    <div className="cert-place-row">
      <span>Place : {place}</span>
      <span>
        Certificate No. : <span className="cert-fill cert-fill-n">{certificateNumber}</span>
      </span>
      <span>
        Date of issue : <span className="cert-fill cert-fill-n">{issueDate}</span>
      </span>
    </div>
  );

  const studyBody = (
    <>
      <div className="cert-row">
        This is to certify that the{" "}
        <span className="cert-fill">
          {prefix} {name}
        </span>
      </div>
      <div className="cert-row">
        {relation} Sri <span className="cert-fill">{parent}</span>
      </div>
      <div className="cert-row">
        in this School from <span className="cert-fill">{studiedFrom}</span> to <span className="cert-fill">{studiedTo}</span> during the year from{" "}
        <span className="cert-fill cert-fill-y">{yearFrom}</span> to <span className="cert-fill cert-fill-y">{yearTo}</span>
      </div>
      <div className="cert-row">
        {possessiveCap} date of birth as per the record of this institution is <span className="cert-fill">{dateOfBirth}</span>
      </div>
      <div className="cert-row">
        (in words <span className="cert-fill">{dobWords}</span> )
      </div>
      <div className="cert-row">
        {possessiveCap} conduct was <span className="cert-fill">{conduct}</span> during this period.
      </div>
      <div className="cert-note">The above particulars are true and correct as per the school records.</div>
    </>
  );

  const bonafideBody = (
    <>
      <div className="cert-row cert-row-first">
        This is to certify that <span className="cert-fill">{prefixShort} {name}</span>
      </div>
      <div className="cert-row">
        <span>Roll No.</span>
        <span className="cert-fill cert-fill-n">{rollNo || "-"}</span>
        <span style={{ marginLeft: "14px" }}>Admission No.</span>
        <span className="cert-fill cert-fill-n">{admissionNumber}</span>
      </div>
      <div className="cert-row">
        {relation} {parentTitle} <span className="cert-fill">{parent}</span>
      </div>
      <div className="cert-row cert-row-para">
        is a bonafide student of this school and studied in Class <span className="cert-fill cert-fill-n">{className}</span> during the academic year{" "}
        <span className="cert-fill cert-fill-n">{year}</span>.
      </div>
      <div className="cert-row">
        As per school records, {pronounPossessive} date of birth is <span className="cert-fill">{dateOfBirth}</span>
      </div>
      <div className="cert-row">
        (in words <span className="cert-fill">{dobWords}</span> )
      </div>
      {prevYear ? (
        <div className="cert-row cert-row-para">
          This is to also certify that the above named child had studied in this School in the previous academic year{" "}
          <span className="cert-fill cert-fill-n">{prevYear}</span>.
        </div>
      ) : null}
      <div className="cert-row">{pronounSubject} bears a good moral character.</div>
    </>
  );

  const genericBody = (
    <>
      <div className="cert-row cert-row-first">
        This is to certify that <span className="cert-fill">{prefix} {name}</span>
      </div>
      <div className="cert-row">
        {relation} {parentTitle} <span className="cert-fill">{parent}</span>
      </div>
      <div className="cert-row cert-row-para">
        is a student of this school in {classSection} during the academic year <span className="cert-fill cert-fill-n">{year}</span>.
      </div>
      <div className="cert-row">
        {possessiveCap} date of birth as per the school records is <span className="cert-fill">{dateOfBirth}</span>
      </div>
      <div className="cert-row">
        (in words <span className="cert-fill">{dobWords}</span> )
      </div>
      <div className="cert-row">{pronounSubject} bears a good moral character.</div>
    </>
  );

  const manualBody = (
    <>
      <div className="cert-adm">
        <div>
          Admn. No. <span className="cert-box">&nbsp;</span>
        </div>
        <div>
          Admn. Date : <span className="cert-box">&nbsp;</span>
        </div>
      </div>
      <div className="cert-row">
        This is to certify that the Kumari / Kumar <span className="cert-fill">&nbsp;</span>
      </div>
      <div className="cert-row">
        D/o. / S/o. Sri <span className="cert-fill">&nbsp;</span>
      </div>
      <div className="cert-row">
        in this School from <span className="cert-fill">&nbsp;</span> to <span className="cert-fill">&nbsp;</span> during
        the year from <span className="cert-fill cert-fill-y">&nbsp;</span> to{" "}
        <span className="cert-fill cert-fill-y">&nbsp;</span>
      </div>
      <div className="cert-row">
        His / Her date of birth as per the record of this institution is <span className="cert-fill">&nbsp;</span>
      </div>
      <div className="cert-row">
        (in words <span className="cert-fill">&nbsp;</span> )
      </div>
      <div className="cert-row">
        His / Her conduct was <span className="cert-fill">&nbsp;</span> during this period.
      </div>
      <div className="cert-place-row">
        <span>Place : Ghanpur</span>
        <span>
          Date of issue : <span className="cert-fill cert-fill-n">&nbsp;</span>
        </span>
      </div>
    </>
  );

  const transferRows: Array<[string, string]> = [
    ["Name of the Pupil", name],
    ["Mother's Name", motherName],
    ["Father's or Guardian's Name", fatherName],
    ["Date of Birth (in figures)", dateOfBirth],
    ["Date of Birth (in words)", dobWords],
    ["Nationality", nationality],
    ["Religion", religion],
    ["Whether the candidate belongs to Scheduled Caste, Scheduled Tribe or OBC", category],
    ["Date of first admission in the school with class", firstAdmission],
    ["Class in which the pupil last studied (in figures and in words)", lastClass],
    ["School / Board Annual Examination last taken, with result", lastExam],
    ["Whether failed; if so, once or twice in the same class", failed],
    ["Subjects studied", subjects],
    ["Whether qualified for promotion to the higher class; if so, to which class (in figures and in words)", promotion],
    ["Month up to which the pupil has paid school dues", duesMonth],
    ["Any fee concession availed of; if so, the nature of such concession", concession],
    ["Date of application for TC", appliedDate],
    ["Date of issue of TC", issuedDate],
    ["Number of school days up to date", daysTotal],
    ["Number of school days the pupil attended", daysAttended],
    ["General conduct", conduct]
  ];

  const transferPage = (
    <div className="cert-tc-page">
      {duplicate && <div className="cert-tc-dup">DUPLICATE</div>}
      <div className="cert-tc-in">
        <div className="cert-tc-head">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/certificate-logo.png" alt="School logo" />
          <div className="cert-tc-title">
            <h1>SRI NARAYANA HIGH SCHOOL</h1>
            <p>Ghanpur, Jayashankar Bhupalpally, Telangana</p>
            <p>School Code: 17105 &nbsp;|&nbsp; Recognized by Telangana Government &nbsp;|&nbsp; Ph: 6300038389</p>
          </div>
        </div>
        <h2>TRANSFER CERTIFICATE</h2>
        <div className="cert-tc-meta">
          <span>
            TC No.: <b>{tcNo || "—"}</b>
          </span>
          <span>
            Admission No.: <b>{admissionNumber || "—"}</b>
          </span>
        </div>
        <table>
          <tbody>
            {transferRows.map(([label, value], index) => (
              <tr key={label}>
                <td className="n">{index + 1}.</td>
                <td className="l">{label}</td>
                <td className="v">{value || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="cert-tc-sign">
          <div>Class Teacher</div>
          <div>Principal</div>
        </div>
      </div>
    </div>
  );

  if (!mounted) return null;

  return createPortal(
    <div className="cert-overlay">
      <div className="cert-bar">
        <button type="button" className="cert-btn cert-btn-ghost" onClick={() => void handleCancel()} disabled={busy}>
          <X size={14} /> {manual ? "Close" : "Cancel"}
        </button>
        <span className="cert-bar-info">
          {title}
          {certificateNumber ? ` · ${certificateNumber}` : ""}
        </span>
        {consumeError && <span className="cert-bar-error">{consumeError}</span>}
        <label className="cert-dup-toggle">
          <input type="checkbox" checked={duplicate} onChange={(e) => setDuplicate(e.target.checked)} /> Duplicate copy
        </label>
        {desktopPdf && (
          <button type="button" className="cert-btn" onClick={() => void handlePdf()} disabled={busy}>
            <Download size={14} /> Save PDF
          </button>
        )}
        <button type="button" className="cert-btn" onClick={() => void handlePrint()} disabled={busy}>
          <Printer size={14} /> {busy ? "Preparing…" : "Print"}
        </button>
      </div>

      <div className="cert-wrap">
        {isTransfer ? (
          transferPage
        ) : (
        <div className="cert-page">
          <div className="cert-frame">
            <i className="cert-co cert-co-a" />
            <i className="cert-co cert-co-b" />
            <i className="cert-co cert-co-c" />
            <i className="cert-co cert-co-d" />
            {duplicate && <div className="cert-dup">DUPLICATE</div>}
            {header}
            <div className="cert-ribbon">{title}</div>

            {manual && manualBody}

            {!manual && isStudyDob && (
              <>
                <div className="cert-adm">
                  <div>
                    Admn. No. <span className="cert-box">{admissionNumber}</span>
                  </div>
                  <div>
                    Admn. Date : <span className="cert-box">{admissionDate}</span>
                  </div>
                </div>
                {studyBody}
              </>
            )}

            {!manual && isBonafide && (
              <>
                <div className="cert-adm cert-adm-empty" />
                {bonafideBody}
              </>
            )}

            {!manual && !isStudyDob && !isBonafide && genericBody}

            {!manual && metaRows}
            {footer}
          </div>
        </div>
        )}
      </div>

      <style>{`
        .cert-overlay { position: fixed; inset: 0; z-index: 100; background: #e9ecf3; overflow: auto; }
        .cert-bar { display: flex; align-items: center; justify-content: center; gap: 12px; flex-wrap: wrap; padding: 12px; background: #fff; color: #222; font: 14px system-ui, sans-serif; position: sticky; top: 0; z-index: 2; box-shadow: 0 1px 4px rgba(0,0,0,.08); }
        .cert-bar-info { font-weight: 700; }
        .cert-bar-error { color: #c0392b; font-size: 12px; font-weight: 700; }
        .cert-btn { display: inline-flex; align-items: center; gap: 6px; font-size: 14px; padding: 8px 14px; border-radius: 8px; border: 0; background: #222; color: #fff; cursor: pointer; text-decoration: none; }
        .cert-btn:disabled { opacity: .6; cursor: wait; }
        .cert-btn-ghost { background: #eef0f7; color: #222; }
        .cert-dup-toggle { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; cursor: pointer; }
        .cert-wrap { overflow-x: auto; padding: 20px 12px; }
        .cert-page { width: 210mm; height: 148mm; margin: 0 auto; background: #fff; color: #111; padding: 4mm; overflow: hidden; font-family: Georgia, "Times New Roman", serif; }
        .cert-frame { height: 100%; background: url(/certificate-frame.png) center 58%/62mm no-repeat, repeating-radial-gradient(circle at 50% 135%, rgba(26,35,126,.05) 0 .6px, transparent .6px 5px); border: 1.5px solid #111; padding: 4.5mm 9mm 0; position: relative; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .cert-frame:before { content: ""; position: absolute; inset: 2.5px; border: 5px solid; border-image: repeating-linear-gradient(45deg, #111 0 1.4px, #fff 1.4px 3px) 5; pointer-events: none; }
        .cert-frame:after { content: ""; position: absolute; inset: 9.5px; border: 1px solid #111; pointer-events: none; }
        .cert-head { display: flex; align-items: center; gap: 8px; border-bottom: 3px double #1a237e; padding-bottom: 5px; }
        .cert-logo { width: 22mm; flex: none; }
        .cert-logo img { width: 20mm; height: 20mm; display: block; }
        .cert-titleblock { flex: 1; text-align: center; }
        .cert-titleblock h1 { margin: 0; font-size: 25px; letter-spacing: 1px; color: #1a237e; text-transform: uppercase; }
        .cert-titleblock p { margin: 1px 0; font-size: 11px; }
        .cert-qrslot { width: 20mm; flex: none; margin-left: auto; }
        .cert-qrslot img { width: 20mm; height: 20mm; display: block; margin-left: auto; }
        .cert-qrcaption { font: 7px system-ui, sans-serif; text-align: center; width: 20mm; margin-left: auto; }
        .cert-ribbon { display: table; margin: 7px auto 5px; background: #1a237e; color: #fff; border-top: 2px solid #b8892b; border-bottom: 2px solid #b8892b; padding: 4px 40px; font-weight: bold; font-size: 15px; text-transform: uppercase; letter-spacing: 1.6px; clip-path: polygon(0 0,100% 0,calc(100% - 12px) 50%,100% 100%,0 100%,12px 50%); -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .cert-adm { display: flex; justify-content: space-between; align-items: center; font-size: 12px; margin: 4px 0 2px; }
        .cert-adm-empty { margin: 2px 0 0; }
        .cert-box { color: #0b1b5a; background: #f3f5ff; display: inline-block; min-width: 38mm; height: 7mm; border: 1.5px solid #111; border-radius: 5px; vertical-align: middle; line-height: 6mm; text-align: center; font-weight: bold; margin-left: 4px; padding: 0 6px; }
        .cert-row { display: flex; align-items: flex-end; gap: 6px; font-size: 15px; margin: 9px 0; white-space: nowrap; }
        .cert-row-first { margin-top: 8px; }
        .cert-row-para { white-space: normal; line-height: 1.65; display: block; }
        .cert-fill { color: #0b1b5a; font-size: 16px; flex: 1; border-bottom: 1px dotted #111; font-weight: bold; text-align: center; padding: 0 4px; min-height: 20px; white-space: normal; }
        .cert-fill-y { flex: none; width: 17mm; }
        .cert-fill-n { display: inline-block; flex: none; min-width: 36mm; }
        .cert-note { font-size: 12px; font-style: italic; text-align: center; margin-top: 6px; }
        .cert-place-row { display: flex; justify-content: space-between; align-items: center; font-size: 12px; margin-top: 10px; gap: 8px; }
        .cert-foot { position: absolute; left: 9mm; right: 9mm; bottom: 4.5mm; display: flex; justify-content: space-between; align-items: flex-end; font-size: 12px; }
        .cert-foot > div:first-child, .cert-foot > div:last-child { border-top: 1px solid #111; padding-top: 2px; min-width: 34mm; text-align: center; font-size: 11px; }
        .cert-foot-center { text-align: center; font-size: 8.5px; line-height: 1.35; text-transform: uppercase; }
        .cert-dup { display: block; position: absolute; top: 25mm; right: 8mm; border: 2px solid #111; padding: 1px 8px; font: bold 12px system-ui, sans-serif; letter-spacing: 2px; transform: rotate(-6deg); z-index: 3; }
        .cert-co { position: absolute; z-index: 2; width: 12mm; height: 12mm; background: url("data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'%3E%3Crect width='40' height='40' fill='white'/%3E%3Cpath d='M4 36V10Q4 4 10 4H36' fill='none' stroke='%231a237e' stroke-width='2.2'/%3E%3Cpath d='M9 36V14Q9 9 14 9H36' fill='none' stroke='%23b8892b' stroke-width='1'/%3E%3Cpath d='M15 9l5 5-5 5-5-5z' fill='%23b8892b'/%3E%3Ccircle cx='15' cy='14' r='1.4' fill='white'/%3E%3C/svg%3E") center/contain no-repeat; pointer-events: none; }
        .cert-co-a { top: .6mm; left: .6mm; }
        .cert-co-b { top: .6mm; right: .6mm; transform: scaleX(-1); }
        .cert-co-c { bottom: .6mm; left: .6mm; transform: scaleY(-1); }
        .cert-co-d { bottom: .6mm; right: .6mm; transform: scale(-1); }
        .cert-tc-page { position: relative; width: 215.9mm; height: 355.6mm; margin: 0 auto; background: #fff; color: #000; padding: 14mm 16mm; font-family: "Times New Roman", Times, serif; font-size: 12.5pt; box-sizing: border-box; }
        .cert-tc-in { border: 1.5px solid #000; height: 100%; padding: 6mm 10mm; display: flex; flex-direction: column; box-sizing: border-box; }
        .cert-tc-head { display: flex; align-items: center; gap: 6mm; border-bottom: 2px solid #000; padding-bottom: 4mm; }
        .cert-tc-head img { width: 24mm; height: 24mm; object-fit: contain; }
        .cert-tc-title { flex: 1; text-align: center; }
        .cert-tc-title h1 { margin: 0; font-size: 22pt; letter-spacing: .5pt; }
        .cert-tc-title p { margin: 1mm 0 0; font-size: 11pt; }
        .cert-tc-page h2 { text-align: center; margin: 6mm 0 4mm; font-size: 16pt; letter-spacing: 2px; text-decoration: underline; }
        .cert-tc-meta { display: flex; justify-content: space-between; margin-bottom: 4mm; }
        .cert-tc-page table { width: 100%; border-collapse: collapse; }
        .cert-tc-page td { padding: 1.4mm 1mm; vertical-align: bottom; border-bottom: 1px dotted #555; }
        .cert-tc-page td.n { width: 9mm; }
        .cert-tc-page td.l { width: 92mm; }
        .cert-tc-page td.v { font-weight: 700; }
        .cert-tc-sign { margin-top: auto; display: flex; justify-content: space-between; padding-top: 14mm; }
        .cert-tc-sign div { text-align: center; min-width: 55mm; border-top: 1px solid #000; padding-top: 1.5mm; }
        .cert-tc-dup { position: absolute; top: 40mm; right: 22mm; border: 2px solid #111; padding: 2px 12px; font: bold 14px system-ui, sans-serif; letter-spacing: 3px; transform: rotate(-8deg); z-index: 3; }
        @page { size: ${isTransfer ? "215.9mm 355.6mm" : "210mm 148mm"}; margin: 0; }
        @media print {
          body { background: #fff; }
          body * { visibility: hidden; }
          .cert-overlay { position: static; background: none; }
          .cert-overlay, .cert-overlay * { visibility: visible; }
          .cert-bar { display: none; }
          .cert-wrap { padding: 0; overflow: visible; }
          .cert-page { position: fixed; left: 0; top: 0; margin: 0; }
          .cert-tc-page { position: fixed; left: 0; top: 0; margin: 0; }
        }
      `}</style>
    </div>,
    document.body
  );
}
