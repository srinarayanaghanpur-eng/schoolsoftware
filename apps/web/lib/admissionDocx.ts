/**
 * Admission DOCX generator — renders ERP student data into the uploaded
 * DOCX master template's exact visual structure (Calibri, section bars,
 * label/value tables, checkboxes, declaration, signatures, office use).
 *
 * Data resolution mirrors useAdmissionData so the DOCX matches the screen.
 */
import {
  AlignmentType,
  BorderStyle,
  Document,
  Header,
  Footer,
  ImageRun,
  Packer,
  PageBreak,
  Paragraph,
  ShadingType,
  SimpleField,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  VerticalAlignTable,
  WidthType
} from "docx";
import { adminDb } from "@/lib/firebaseAdmin";
import { getBranches } from "@/lib/branchContext";

/* --------------------------------------------------------------- constants */

const FONT = "Calibri";
const LABEL_GREEN = "3F9B4C";
const LABEL_FILL = "EAF2FF";
const BAR_NUM_FILL = "4D96FF";
const BAR_TITLE_FILL = "E4EFFF";
const BAR_TITLE_TEXT = "2D2D2D";
const GRID_COLOR = "BFBFBF";

const FULL = 100;
const COL_LABEL = 1594; // 79.7pt label column (twips)
const COL_VALUE = 3549; // 177.45pt value column (twips)

/* ------------------------------------------------------------------ types */

export type AdmissionDocData = {
  admissionNo: string;
  admissionDate: string;
  classApplied: string;
  section: string;
  medium: string;
  academicYearName: string;
  secondLang: string;
  admissionType: string;
  name: string;
  gender: string;
  dob: string;
  aadhaar: string;
  bloodGroup: string;
  emis: string;
  nationality: string;
  motherTongue: string;
  category: string;
  fatherName: string;
  fatherMobile: string;
  fatherOcc: string;
  motherName: string;
  motherMobile: string;
  motherOcc: string;
  guardianName: string;
  guardianRelation: string;
  emergencyPhone: string;
  addressLine: string;
  village: string;
  mandal: string;
  district: string;
  pincode: string;
  prevSchool: string;
  lastClass: string;
  tcNo: string;
  transportRequired: string;
  routeName: string;
  pickupPoint: string;
  feePlan: string;
  feeTypes: string;
  totalFee: string;
  concession: string;
  documents: { label: string; checked: boolean }[];
  otherDocuments: string;
  admissionStatus: string;
  verifiedByName: string;
  createdByName: string;
  studentLogin: string;
  parentLogin: string;
  createdDate: string;
  lastUpdated: string;
  branchName: string;
  schoolId: string;
  photo?: { data: Uint8Array; width: number; height: number; kind: "png" | "jpg" | "gif" };
};

/* ------------------------------------------------------- small pure helpers */

function str(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "";
  return "";
}

function fmtMoney(value: unknown): string {
  if (typeof value === "number" && Number.isFinite(value)) {
    return `\u20B9${value.toLocaleString("en-IN")}`;
  }
  return str(value);
}

function fmtDate(value: unknown): string {
  let d: Date | null = null;
  if (value instanceof Date) d = value;
  else if (value && typeof value === "object") {
    const o = value as { _seconds?: number; _nanoseconds?: number; toDate?: () => Date };
    if (typeof o.toDate === "function") {
      try {
        d = o.toDate();
      } catch {
        d = null;
      }
    } else if (typeof o._seconds === "number") {
      d = new Date(o._seconds * 1000 + (o._nanoseconds ?? 0) / 1e6);
    }
  } else if (typeof value === "string" && value.trim()) {
    const parsed = new Date(value.trim());
    if (!Number.isNaN(parsed.getTime())) d = parsed;
  }
  if (!d) return "";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}-${mm}-${d.getFullYear()}`;
}

function fmtDateTimeKolkata(d: Date): string {
  const parts = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).formatToParts(d);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("day")}-${get("month")}-${get("year")} ${get("hour")}:${get("minute")}`;
}

/* ------------------------------------------------------------------ photo */

function probeImageSize(buffer: Uint8Array): { width: number; height: number; kind: "png" | "jpg" | "gif" } | null {
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  const len = buffer.length;
  // PNG: 8-byte signature, IHDR at 16.
  if (len > 24 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    return { width: view.getUint32(16), height: view.getUint32(20), kind: "png" };
  }
  // GIF: 6-byte header, dims at 6 (LE).
  if (len > 10 && buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) {
    return { width: view.getUint16(6, true), height: view.getUint16(8, true), kind: "gif" };
  }
  // JPEG: scan for SOF0/1/2.
  if (len > 4 && buffer[0] === 0xff && buffer[1] === 0xd8) {
    let i = 2;
    while (i + 8 < len) {
      if (buffer[i] !== 0xff) break;
      const marker = buffer[i + 1];
      const size = view.getUint16(i + 2);
      if ((marker >= 0xc0 && marker <= 0xc3) && marker !== 0xc2) {
        return { width: view.getUint16(i + 7), height: view.getUint16(i + 5), kind: "jpg" };
      }
      if (size < 2) break;
      i += 2 + size;
    }
  }
  return null;
}

async function fetchPhoto(url: string): Promise<AdmissionDocData["photo"]> {
  try {
    let buffer: Uint8Array;
    let kind: "png" | "jpg" | "gif" = "jpg";
    if (url.startsWith("data:")) {
      const match = url.match(/^data:image\/(png|jpe?g|gif);base64,(.*)$/s);
      if (!match) return undefined;
      kind = match[1].startsWith("png") ? "png" : match[1] === "gif" ? "gif" : "jpg";
      buffer = new Uint8Array(Buffer.from(match[2], "base64"));
    } else {
      const response = await fetch(url);
      if (!response.ok) return undefined;
      const contentType = response.headers.get("content-type") ?? "";
      if (contentType.includes("png")) kind = "png";
      else if (contentType.includes("gif")) kind = "gif";
      buffer = new Uint8Array(await response.arrayBuffer());
    }
    if (buffer.length === 0 || buffer.length > 5 * 1024 * 1024) return undefined;
    const probed = probeImageSize(buffer);
    // Fit inside the photograph box, never upscale, never distort.
    const maxW = 150;
    const maxH = 190;
    if (!probed || !probed.width || !probed.height) {
      return { data: buffer, width: 150, height: 190, kind };
    }
    const scale = Math.min(1, maxW / probed.width, maxH / probed.height);
    return {
      data: buffer,
      width: Math.max(1, Math.round(probed.width * scale)),
      height: Math.max(1, Math.round(probed.height * scale)),
      kind: probed.kind
    };
  } catch {
    return undefined;
  }
}

/* ------------------------------------------------------------- data fetch */

export async function getAdmissionDocData(studentId: string): Promise<AdmissionDocData> {
  const db = adminDb();
  const [studentSnap, yearsSnap, branches, routesSnap, usersSnap] = await Promise.all([
    db.collection("students").doc(studentId).get(),
    db.collection("academic_years").limit(500).get(),
    getBranches().catch(() => [] as { id: string; name: string }[]),
    db.collection("transport_routes").limit(500).get(),
    db.collection("users").limit(500).get()
  ]);
  if (!studentSnap.exists) throw new Error("Student not found");
  const s = (studentSnap.data() ?? {}) as Record<string, unknown>;

  const yearMap = new Map<string, string>();
  yearsSnap.docs.forEach((d) => yearMap.set(d.id, String((d.data() as Record<string, unknown>).name ?? "")));
  const branchMap = new Map<string, string>();
  branches.forEach((b) => branchMap.set(b.id, b.name));
  const userMap = new Map<string, string>();
  usersSnap.docs.forEach((d) => {
    const u = d.data() as Record<string, unknown>;
    userMap.set(d.id, String(u.displayName ?? u.email ?? u.employeeId ?? d.id));
  });
  const routeMap = new Map<string, string>();
  routesSnap.docs.forEach((d) => routeMap.set(d.id, String((d.data() as Record<string, unknown>).name ?? "")));

  const prevSchool = s.previousSchool;
  const prevName = typeof prevSchool === "string" ? prevSchool : str((prevSchool as Record<string, unknown> | null)?.name);
  const prevOf = (key: string) =>
    typeof prevSchool === "string" ? "" : str((prevSchool as Record<string, unknown> | null)?.[key] ?? (s as Record<string, unknown>)[key]);
  const emergency = s.emergencyContact;
  const emgOf = (key: string) =>
    typeof emergency === "string" ? (key === "phone" ? emergency : "") : str((emergency as Record<string, unknown> | null)?.[key]);

  const ayId = str((s.academicYearId ?? s.academicYear ?? s.academicYearName) as unknown);
  const feeHeads = Array.isArray(s.feeHeads) ? (s.feeHeads as { name: string; amount?: unknown; committed?: unknown }[]) : null;
  const feeTypes = feeHeads
    ? feeHeads
        .map((h) => {
          const amount = Number((h.committed ?? h.amount) as unknown);
          return Number.isFinite(amount) && amount > 0 ? `${h.name} (\u20B9${amount.toLocaleString("en-IN")})` : h.name;
        })
        .join(", ")
    : "";
  const totalFeeRaw = (s.totalFeeAmount ?? s.commitmentFee) as unknown;
  const concession =
    (s.concession ?? s.totalFeeAmount) !== undefined && (s.concession ?? s.totalFeeAmount) !== null && (s.concession ?? s.totalFeeAmount) !== ""
      ? Number(s.totalFeeAmount) - Number((s.commitmentFee ?? s.totalFeeAmount) as unknown)
      : "";
  const docNames = Array.isArray(s.documentURLs)
    ? (s.documentURLs as { name?: unknown }[]).map((d) => String(d.name ?? "").toLowerCase()).join(" ")
    : "";
  const hasDoc = (...needles: string[]) => needles.some((n) => docNames.includes(n));
  const aadhaar = str((s.studentAadhaar ?? s.aadhaarNumber) as unknown);
  const knownDocWords = ["birth", "aadhaar", "parent aadhaar", "father aadhaar", "mother aadhaar", "tc", "bonafide", "report", "photo", "caste", "income"];
  const otherDocuments = Array.isArray(s.documentURLs)
    ? (s.documentURLs as { name?: unknown }[])
        .map((d) => String(d.name ?? "").trim())
        .filter((n) => n && !knownDocWords.some((w) => n.toLowerCase().includes(w)))
        .join(", ")
    : "";

  const transportRequired =
    s.transportRequired || str(s.transportRouteId) || str(s.transportStopName) ? "Yes" : "No";

  const data: AdmissionDocData = {
    admissionNo: str((s.admissionNumber ?? s.admissionNo) as unknown),
    admissionDate: fmtDate(s.createdAt),
    classApplied: str((s.classApplied ?? s.class) as unknown),
    section: str(s.section),
    medium: str(s.medium),
    academicYearName: str(s.academicYearName) || yearMap.get(ayId) || ayId,
    secondLang: str(s.secondLanguage),
    admissionType: str(s.admissionType),
    name: str(s.studentName),
    gender: str(s.gender),
    dob: fmtDate(s.dateOfBirth),
    aadhaar,
    bloodGroup: str(s.bloodGroup),
    emis: str(s.emisId),
    nationality: str(s.nationality),
    motherTongue: str(s.motherTongue),
    category: str(s.category),
    fatherName: str(s.fatherName),
    fatherMobile: str((s.fatherMobile ?? s.fatherPhone ?? s.phone) as unknown),
    fatherOcc: str(s.fatherOccupation),
    motherName: str(s.motherName),
    motherMobile: str((s.motherMobile ?? s.motherPhone) as unknown),
    motherOcc: str(s.motherOccupation),
    guardianName: str((s.guardianName ?? (typeof emergency === "string" ? "" : emgOf("name"))) as unknown),
    guardianRelation: str((s.guardianRelation ?? (typeof emergency === "string" ? "" : emgOf("relation"))) as unknown),
    emergencyPhone: str(emgOf("phone")),
    addressLine: str((s.addressLine ?? s.address) as unknown),
    village: str(s.villageArea),
    mandal: str(s.mandal),
    district: str(s.district),
    pincode: str(s.pincode),
    prevSchool: prevName,
    lastClass: prevOf("lastClass"),
    tcNo: prevOf("tcNo"),
    transportRequired,
    routeName: routeMap.get(str(s.transportRouteId)) || str((s.busRoute ?? s.transportRouteName) as unknown),
    pickupPoint: str((s.pickupPoint ?? s.transportStopName) as unknown),
    feePlan: str((s.feePlan ?? (s.totalFeeAmount ? "Standard" : "")) as unknown),
    feeTypes,
    totalFee: fmtMoney(totalFeeRaw),
    concession: typeof concession === "number" && Number.isFinite(concession) ? fmtMoney(concession) : "",
    documents: [
      { label: "Birth Certificate", checked: hasDoc("birth") },
      { label: "Student Aadhaar", checked: Boolean(aadhaar) || hasDoc("student aadhaar", "aadhaar") },
      { label: "Parent Aadhaar", checked: hasDoc("parent aadhaar", "father aadhaar", "mother aadhaar") },
      { label: "TC / Bonafide", checked: Boolean(prevOf("tcNo")) || hasDoc("tc", "bonafide") },
      { label: "Previous Report Card", checked: hasDoc("report") },
      { label: "Passport Photos", checked: Boolean(s.photoURL) || hasDoc("photo") },
      { label: "Caste / Income Certificate", checked: hasDoc("caste", "income") },
      {
        label: "Other Documents",
        checked: Array.isArray(s.documentURLs) && (s.documentURLs as unknown[]).length > 0
      }
    ],
    otherDocuments,
    admissionStatus: str((s.admissionStatus ?? "Pending") as unknown),
    verifiedByName: userMap.get(str(s.verifiedBy)) || str(s.verifiedBy) || "—",
    createdByName: userMap.get(str(s.createdBy)) || str(s.createdBy) || "—",
    studentLogin: str(s.studentLogin),
    parentLogin: str(s.parentLogin),
    createdDate: fmtDate(s.createdAt),
    lastUpdated: fmtDate(s.updatedAt),
    branchName: branchMap.get(str(s.branchId)) || "",
    schoolId: str(s.schoolId)
  };

  const photoURL = str(s.photoURL);
  if (photoURL) {
    data.photo = await fetchPhoto(photoURL);
  }
  return data;
}

/* ---------------------------------------------------------- docx building */

function run(text: string, opts: { bold?: boolean; size?: number; color?: string; font?: string } = {}): TextRun {
  return new TextRun({
    text,
    bold: opts.bold,
    size: opts.size,
    color: opts.color,
    font: opts.font ?? FONT
  });
}

function para(children: (TextRun | PageBreak)[], opts: { align?: (typeof AlignmentType)[keyof typeof AlignmentType]; size?: number } = {}): Paragraph {
  return new Paragraph({ children, alignment: opts.align });
}

function bordersAll(): Record<string, { style: (typeof BorderStyle)[keyof typeof BorderStyle]; size: number; color: string }> {
  const edge = { style: BorderStyle.SINGLE, size: 6, color: GRID_COLOR };
  return { top: edge, left: edge, bottom: edge, right: edge, insideH: edge, insideV: edge };
}

function cell(
  children: Paragraph[],
  opts: { fill?: string; width?: number; vAlign?: (typeof VerticalAlignTable)[keyof typeof VerticalAlignTable] } = {}
): TableCell {
  return new TableCell({
    children,
    width: opts.width !== undefined ? { size: opts.width, type: WidthType.DXA } : undefined,
    shading: opts.fill ? { type: ShadingType.CLEAR, fill: opts.fill } : undefined,
    verticalAlign: opts.vAlign ?? VerticalAlignTable.CENTER
  });
}

function labelCell(text: string, width?: number): TableCell {
  return cell([para([run(text.toUpperCase(), { bold: true, size: 16, color: LABEL_GREEN })])], {
    fill: LABEL_FILL,
    width
  });
}

function valueCell(text: string, width?: number): TableCell {
  return cell([para([run(text, { size: 19 })])], { width });
}

/** One label/value pair row (2 cells). */
function pairRow(label: string, value: string): TableRow {
  return new TableRow({ children: [labelCell(label, COL_LABEL), valueCell(value)] });
}

/** Two label/value pairs in one row (4 cells). */
function quadRow(l1: string, v1: string, l2: string, v2: string): TableRow {
  return new TableRow({
    children: [labelCell(l1, COL_LABEL), valueCell(v1, COL_VALUE), labelCell(l2, COL_LABEL), valueCell(v2, COL_VALUE)]
  });
}

function fixedTable(rows: TableRow[], widths: number[]): Table {
  return new Table({
    rows,
    width: { size: FULL, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    columnWidths: widths,
    borders: bordersAll()
  });
}

function sectionBar(num: string, title: string): Table {
  return fixedTable(
    [
      new TableRow({
        children: [
          cell([para([run(num, { bold: true, size: 24, color: "FFFFFF" })])], { fill: BAR_NUM_FILL, width: 880 }),
          cell([para([run(title, { bold: true, size: 23, color: BAR_TITLE_TEXT })])], { fill: BAR_TITLE_FILL, width: 7900 }),
          cell([para([])], { fill: BAR_TITLE_FILL, width: 1506 })
        ]
      })
    ],
    [880, 7900, 1506]
  );
}

function signatureCell(title: string): TableCell {
  return cell(
    [
      para([run(title, { bold: true, size: 16 })]),
      para([run("Signature: __________________", { size: 16 })]),
      para([run("Date: __________________", { size: 16 })])
    ],
    { width: 3429 }
  );
}

export async function buildAdmissionDocx(d: AdmissionDocData, printedAt: Date): Promise<Buffer> {
  const printed = fmtDateTimeKolkata(printedAt);
  const children: (Table | Paragraph)[] = [];

  /* ------------------------------- header ------------------------------- */
  const photoChildren: Paragraph[] = d.photo
    ? [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new ImageRun({
              data: d.photo.data,
              transformation: { width: d.photo.width, height: d.photo.height },
              type: d.photo.kind === "png" ? "png" : d.photo.kind === "gif" ? "gif" : "jpg"
            })
          ]
        })
      ]
    : [
        para([run("STUDENT PHOTOGRAPH", { bold: true, size: 15 })], { align: AlignmentType.CENTER }),
        para([run("(affix passport-size photo)", { size: 13 })], { align: AlignmentType.CENTER })
      ];

  children.push(
    fixedTable(
      [
        new TableRow({
          children: [
            cell([
              para([run("SRI NARAYANA HIGH SCHOOL", { bold: true, size: 32 })]),
              para([run("Ghanpur (M), Jayashankar Bhupalpally District", { size: 19 })]),
              para([run("Phone: 6300038389", { size: 19 })]),
              para([run("DIGITAL STUDENT ADMISSION FORM", { bold: true, size: 26 })]),
              para([
                run("ACADEMIC YEAR", { bold: true, size: 18 }),
                run(`:  ${d.academicYearName}`, { size: 18 })
              ])
            ]),
            cell(photoChildren, { width: 2286 })
          ]
        })
      ],
      [8000, 2286]
    )
  );

  /* --------------------------- 01 admission ------------------------------ */
  children.push(sectionBar("01", "ADMISSION DETAILS"));
  children.push(
    fixedTable(
      [
        quadRow("ADMISSION NUMBER", d.admissionNo, "ADMISSION DATE", d.admissionDate),
        quadRow("CLASS APPLIED", d.classApplied, "SECTION", d.section),
        quadRow("MEDIUM", d.medium, "ACADEMIC YEAR", d.academicYearName),
        quadRow("SECOND LANGUAGE", d.secondLang, "ADMISSION TYPE", d.admissionType)
      ],
      [COL_LABEL, COL_VALUE, COL_LABEL, COL_VALUE]
    )
  );

  /* ---------------------------- 02 student ------------------------------ */
  children.push(sectionBar("02", "STUDENT DETAILS"));
  children.push(
    fixedTable(
      [
        new TableRow({ children: [labelCell("STUDENT NAME", COL_LABEL), valueCell(d.name)] }),
        quadRow("GENDER", d.gender, "DATE OF BIRTH", d.dob),
        quadRow("AADHAAR NUMBER", d.aadhaar, "BLOOD GROUP", d.bloodGroup),
        quadRow("EMIS / CHILD ID", d.emis, "NATIONALITY", d.nationality),
        quadRow("MOTHER TONGUE", d.motherTongue, "CATEGORY", d.category)
      ],
      [COL_LABEL, COL_VALUE, COL_LABEL, COL_VALUE]
    )
  );
  children.push(new Paragraph({ children: [new PageBreak()] }));

  /* ------------------------ 03 parent / guardian ------------------------ */
  children.push(sectionBar("03", "PARENT / GUARDIAN DETAILS"));
  children.push(
    fixedTable(
      [
        new TableRow({ children: [labelCell("FATHER NAME", COL_LABEL), valueCell(d.fatherName)] }),
        quadRow("FATHER MOBILE", d.fatherMobile, "FATHER OCCUPATION", d.fatherOcc),
        new TableRow({ children: [labelCell("MOTHER NAME", COL_LABEL), valueCell(d.motherName)] }),
        quadRow("MOTHER MOBILE", d.motherMobile, "MOTHER OCCUPATION", d.motherOcc),
        new TableRow({ children: [labelCell("GUARDIAN NAME", COL_LABEL), valueCell(d.guardianName)] }),
        quadRow("RELATION", d.guardianRelation, "EMERGENCY NUMBER", d.emergencyPhone)
      ],
      [COL_LABEL, COL_VALUE, COL_LABEL, COL_VALUE]
    )
  );

  /* ------------------------------ 04 address ---------------------------- */
  children.push(sectionBar("04", "ADDRESS DETAILS"));
  children.push(
    fixedTable(
      [
        new TableRow({ children: [labelCell("HOUSE / STREET", COL_LABEL), valueCell(d.addressLine)] }),
        quadRow("VILLAGE / AREA", d.village, "MANDAL", d.mandal),
        quadRow("DISTRICT", d.district, "PIN CODE", d.pincode)
      ],
      [COL_LABEL, COL_VALUE, COL_LABEL, COL_VALUE]
    )
  );

  /* ------------------- 05 previous / transport / fee -------------------- */
  children.push(sectionBar("05", "PREVIOUS SCHOOL, TRANSPORT & FEE"));
  children.push(
    fixedTable(
      [
        new TableRow({ children: [labelCell("PREVIOUS SCHOOL", COL_LABEL), valueCell(d.prevSchool)] }),
        quadRow("LAST STUDIED CLASS", d.lastClass, "TC NUMBER", d.tcNo),
        quadRow("TRANSPORT REQUIRED", d.transportRequired, "ROUTE / VILLAGE", d.routeName),
        new TableRow({ children: [labelCell("PICKUP POINT", COL_LABEL), valueCell(d.pickupPoint)] }),
        quadRow("FEE PLAN", d.feePlan, "FEE TYPES ASSIGNED", d.feeTypes),
        quadRow("TOTAL COMMITTED FEE", d.totalFee, "CONCESSION", d.concession)
      ],
      [COL_LABEL, COL_VALUE, COL_LABEL, COL_VALUE]
    )
  );
  children.push(new Paragraph({ children: [new PageBreak()] }));

  /* ----------------------------- 06 documents --------------------------- */
  children.push(sectionBar("06", "DOCUMENTS CHECKLIST"));
  const docRows: TableRow[] = [];
  for (let i = 0; i < d.documents.length; i += 2) {
    const left = d.documents[i];
    const right = d.documents[i + 1];
    const box = (checked: boolean) => run(checked ? "\u2611   " : "\u2610   ", { size: 22 });
    const leftCell = cell(
      [para([box(left.checked), run(left.label, { size: 19 })])],
      { width: 5143 }
    );
    const rightCell = right
      ? cell([para([box(right.checked), run(right.label, { size: 19 })])], { width: 5143 })
      : cell([para([])], { width: 5143 });
    docRows.push(new TableRow({ children: [leftCell, rightCell] }));
  }
  docRows.push(
    new TableRow({
      children: [
        labelCell("OTHER DOCUMENTS (SPECIFY)", 3429),
        valueCell(d.otherDocuments, 6857)
      ]
    })
  );
  children.push(fixedTable(docRows, [5143, 5143]));

  /* ---------------------------- 07 declaration -------------------------- */
  children.push(sectionBar("07", "DECLARATION"));
  const studentRef = d.name || "the above-named student";
  children.push(
    fixedTable(
      [
        new TableRow({
          children: [
            cell([
              para([
                run("I, the parent/guardian of ", { size: 19 }),
                run(studentRef, { bold: true, size: 19 }),
                run(
                  ", hereby declare that all the information provided in this admission form is true and correct to the best of my knowledge. I agree to abide by the rules and regulations of Sri Narayana High School, including the fee schedule, attendance policy, uniform rules, code of conduct, and transport safety instructions. I understand that any false information may lead to the cancellation of admission.",
                  { size: 19 }
                )
              ])
            ])
          ]
        })
      ],
      [10286]
    )
  );

  /* ---------------------------- 08 signatures --------------------------- */
  children.push(sectionBar("08", "SIGNATURES"));
  children.push(
    fixedTable(
      [
        new TableRow({
          children: [signatureCell("PARENT / GUARDIAN"), signatureCell("STUDENT"), signatureCell("PRINCIPAL / OFFICE")]
        })
      ],
      [3429, 3429, 3428]
    )
  );
  children.push(new Paragraph({ children: [new PageBreak()] }));

  /* ------------------------------ 09 office ----------------------------- */
  children.push(sectionBar("09", "OFFICE USE ONLY"));
  children.push(
    para([run("For school administrative use \u2014 not to be filled by parent/guardian.", { size: 19 })])
  );
  children.push(
    fixedTable(
      [
        pairRow("ADMISSION STATUS", d.admissionStatus),
        pairRow("VERIFIED BY", d.verifiedByName),
        pairRow("CREATED BY", d.createdByName),
        pairRow("STUDENT LOGIN", d.studentLogin),
        pairRow("PARENT LOGIN", d.parentLogin),
        pairRow("CREATED DATE", d.createdDate),
        pairRow("LAST UPDATED", d.lastUpdated),
        pairRow("BRANCH", d.branchName),
        pairRow("SCHOOL ID", d.schoolId),
        pairRow("PRINTED DATE / TIME", printed)
      ],
      [COL_LABEL, COL_VALUE]
    )
  );

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: FONT, size: 19 }
        }
      }
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: 11906, height: 16838 },
            margin: { top: 1010, right: 810, bottom: 1010, left: 810 }
          }
        },
        headers: {
          default: new Header({
            children: [
              para([run("DIGITAL STUDENT ADMISSION FORM", { bold: true, size: 16, color: LABEL_GREEN })], {
                align: AlignmentType.CENTER
              })
            ]
          })
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  run("Sri Narayana High School  \u2022  Ghanpur (M), Jayashankar Bhupalpally  \u2022  Ph: 6300038389", {
                    size: 14
                  }),
                  run("\tPage ", { size: 14 }),
                  new SimpleField("PAGE"),
                  run(" of ", { size: 14 }),
                  new SimpleField("NUMPAGES")
                ]
              })
            ]
          })
        },
        children
      }
    ]
  });

  return Packer.toBuffer(doc);
}
