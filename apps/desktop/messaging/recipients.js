const DEFAULT_COUNTRY_CODE = "91";

function normalizePhone(raw, countryCode = DEFAULT_COUNTRY_CODE) {
  const digits = String(raw ?? "").replace(/\D/g, "");
  if (!digits) return "";

  if (digits.length === 10) return `${countryCode}${digits}`;
  if (digits.length === 11 && digits.startsWith("0")) return `${countryCode}${digits.slice(1)}`;
  if (digits.length === 12 && digits.startsWith(countryCode)) return digits;
  if (digits.length >= 11 && digits.length <= 15) return digits;
  return "";
}

function isValidPhone(phone) {
  return /^\d{11,15}$/.test(String(phone ?? ""));
}

function formatDue(value) {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount) || amount <= 0) return "0";
  return amount.toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

function parentNameOf(student) {
  return String(
    student.parentName ||
      student.fatherName ||
      student.motherName ||
      student.guardianName ||
      "Parent"
  ).trim();
}

function phoneOf(student) {
  return normalizePhone(
    student.parentMobile ||
      student.fatherPhone ||
      student.motherPhone ||
      student.guardianPhone ||
      student.phone ||
      ""
  );
}

function classNameOf(student) {
  const className = String(student.class || student.classId || "").trim();
  const section = String(student.section || student.sectionId || "").trim();
  return { className, section };
}

function childLabel(student) {
  const { className, section } = classNameOf(student);
  const classText = className ? `Class ${className}${section ? `-${section}` : ""}` : "";
  return classText ? `${String(student.studentName || "Student").trim()} (${classText})` : String(student.studentName || "Student").trim();
}

function renderTemplate(template, data) {
  return String(template ?? "").replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key) => {
    const value = data[key];
    return value === undefined || value === null ? "" : String(value);
  });
}

const DEFAULT_TEMPLATE =
  "Dear {{parentName}}, fee due for {{children}} is Rs.{{totalDue}}. Kindly pay at the school office. - {{schoolName}}";

/**
 * Groups students by parent phone so a parent with multiple children gets one
 * SMS. Duplicate phones inside the selection are merged; phones that were sent
 * recently are marked duplicate so the runner never re-sends them.
 */
function buildRecipients(students, options = {}) {
  const max = Number(options.max ?? 500);
  const cooldownPhones = options.cooldownPhones instanceof Set
    ? options.cooldownPhones
    : new Set(options.cooldownPhones ?? []);
  const template = String(options.template || DEFAULT_TEMPLATE);
  const schoolName = String(options.schoolName || "Sri Narayana High School");

  const groups = new Map();
  const skipped = [];
  const duplicates = [];
  let overflow = 0;

  for (const student of Array.isArray(students) ? students : []) {
    const phone = phoneOf(student);
    if (!phone || !isValidPhone(phone)) {
      skipped.push({
        studentId: String(student.id ?? ""),
        studentName: String(student.studentName ?? ""),
        reason: "Invalid or missing parent mobile"
      });
      continue;
    }

    const existing = groups.get(phone);
    if (existing) {
      existing.students.push(student);
      existing.totalDue += Number(student.totalFeesDue ?? student.totalDue ?? 0) || 0;
      existing.children = existing.students.map(childLabel).join(", ");
      continue;
    }

    groups.set(phone, {
      phone,
      parentName: parentNameOf(student),
      students: [student],
      totalDue: Number(student.totalFeesDue ?? student.totalDue ?? 0) || 0,
      children: childLabel(student)
    });
  }

  const recipients = [];
  for (const group of groups.values()) {
    if (cooldownPhones.has(group.phone)) {
      duplicates.push({
        phone: group.phone,
        parentName: group.parentName,
        reason: "Sent recently (cooldown)"
      });
      continue;
    }
    if (recipients.length >= max) {
      overflow += 1;
      continue;
    }

    const first = group.students[0] || {};
    const { className, section } = classNameOf(first);
    const data = {
      parentName: group.parentName,
      studentName: String(first.studentName ?? ""),
      children: group.children,
      className,
      section,
      dueAmount: formatDue(group.totalDue),
      totalDue: formatDue(group.totalDue),
      admissionNumber: String(first.admissionNumber ?? first.admissionNo ?? ""),
      schoolName,
      studentCount: group.students.length
    };

    recipients.push({
      studentIds: group.students.map((student) => String(student.id ?? "")).filter(Boolean),
      studentId: String(first.id ?? ""),
      studentName: String(first.studentName ?? ""),
      admissionNumber: String(first.admissionNumber ?? first.admissionNo ?? ""),
      parentName: group.parentName,
      phone: group.phone,
      className,
      section,
      dueAmount: group.totalDue,
      studentCount: group.students.length,
      message: renderTemplate(template, data),
      dedupeKey: group.phone
    });
  }

  return { recipients, skipped, duplicates, overflow };
}

module.exports = {
  DEFAULT_COUNTRY_CODE,
  DEFAULT_TEMPLATE,
  normalizePhone,
  isValidPhone,
  formatDue,
  parentNameOf,
  phoneOf,
  classNameOf,
  childLabel,
  renderTemplate,
  buildRecipients
};
