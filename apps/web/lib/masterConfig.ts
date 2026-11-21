import type { Module } from "@sri-narayana/shared";

export type MasterFieldType = "text" | "textarea" | "number" | "boolean" | "select" | "date";

export type MasterField = {
  key: string;
  label: string;
  type: MasterFieldType;
  required?: boolean;
  placeholder?: string;
  max?: number;
  min?: number;
  step?: number;
  options?: readonly { value: string; label: string }[];
  hideInTable?: boolean;
};

export type MasterConfig = {
  slug: string;
  collection: string;
  title: string;
  description: string;
  module: Module;
  /** Field used for ordering. Defaults to createdAt desc. */
  sortBy?: string;
  fields: MasterField[];
};

const CATEGORIES = [
  { value: "tuition", label: "Tuition" },
  { value: "transport", label: "Transport" },
  { value: "hostel", label: "Hostel" },
  { value: "exam", label: "Examination" },
  { value: "activity", label: "Activity" },
  { value: "other", label: "Other" }
] as const;

const AUDIENCES = [
  { value: "parents", label: "Parents" },
  { value: "students", label: "Students" },
  { value: "staff", label: "Staff" }
] as const;

const ID_TEMPLATES = [
  { value: "classic", label: "Classic" },
  { value: "modern", label: "Modern" },
  { value: "minimal", label: "Minimal" }
] as const;

const ID_ORIENTATIONS = [
  { value: "portrait", label: "Portrait" },
  { value: "landscape", label: "Landscape" }
] as const;

export const MASTER_CONFIGS: readonly MasterConfig[] = [
  {
    slug: "exam-types",
    collection: "exam_types",
    title: "Exam Types",
    description: "Define the kinds of assessments the school runs (unit test, term, annual, practical…).",
    module: "exams",
    sortBy: "name",
    fields: [
      { key: "name", label: "Name", type: "text", required: true, placeholder: "Term 1" },
      { key: "description", label: "Description", type: "textarea", hideInTable: true }
    ]
  },
  {
    slug: "grades",
    collection: "grades",
    title: "Grade Scales",
    description: "Percentage bands used on report cards and marksheets.",
    module: "exams",
    sortBy: "minPercent",
    fields: [
      { key: "name", label: "Grade", type: "text", required: true, placeholder: "A1" },
      { key: "minPercent", label: "From %", type: "number", required: true, min: 0, max: 100, step: 0.01 },
      { key: "maxPercent", label: "To %", type: "number", required: true, min: 0, max: 100, step: 0.01 },
      { key: "gradePoint", label: "Grade point", type: "number", min: 0, max: 10, step: 0.1 },
      { key: "remark", label: "Remark", type: "text", hideInTable: true }
    ]
  },
  {
    slug: "cocurricular-areas",
    collection: "cocurricular_areas",
    title: "Cocurricular Areas",
    description: "Sports, arts and life-skill areas tracked alongside academics.",
    module: "exams",
    sortBy: "name",
    fields: [
      { key: "name", label: "Area", type: "text", required: true, placeholder: "Sports" },
      { key: "description", label: "Description", type: "textarea", hideInTable: true }
    ]
  },
  {
    slug: "assessment-types",
    collection: "assessment_types",
    title: "Assessment Types",
    description: "Competency assessment categories and their weightage.",
    module: "exams",
    sortBy: "name",
    fields: [
      { key: "name", label: "Name", type: "text", required: true },
      { key: "weightage", label: "Weightage (%)", type: "number", min: 0, max: 100, step: 0.01 },
      { key: "description", label: "Description", type: "textarea", hideInTable: true }
    ]
  },
  {
    slug: "departments",
    collection: "departments",
    title: "Departments",
    description: "Academic and administrative departments for staff records.",
    module: "staff",
    sortBy: "name",
    fields: [
      { key: "name", label: "Department", type: "text", required: true, placeholder: "Science" },
      { key: "code", label: "Code", type: "text", max: 20, placeholder: "SCI" }
    ]
  },
  {
    slug: "designations",
    collection: "designations",
    title: "Designations",
    description: "Job titles used on staff profiles and payroll.",
    module: "staff",
    sortBy: "name",
    fields: [
      { key: "name", label: "Designation", type: "text", required: true, placeholder: "Senior Teacher" },
      { key: "department", label: "Department", type: "text", placeholder: "Science" },
      { key: "level", label: "Level", type: "number", min: 0, max: 20 }
    ]
  },
  {
    slug: "leave-types",
    collection: "leave_types",
    title: "Leave Types",
    description: "Casual, sick and other leave policies for staff.",
    module: "staff",
    sortBy: "name",
    fields: [
      { key: "name", label: "Leave type", type: "text", required: true, placeholder: "Casual Leave" },
      { key: "maxDaysPerYear", label: "Days / year", type: "number", required: true, min: 0, max: 365 },
      { key: "paid", label: "Paid leave", type: "boolean" }
    ]
  },
  {
    slug: "salary-templates",
    collection: "salary_templates",
    title: "Salary Templates",
    description: "Reusable salary structures for different designations.",
    module: "payroll",
    sortBy: "name",
    fields: [
      { key: "name", label: "Template", type: "text", required: true },
      { key: "basic", label: "Basic (₹)", type: "number", required: true, min: 0, step: 0.01 },
      { key: "hra", label: "HRA (₹)", type: "number", min: 0, step: 0.01 },
      { key: "allowances", label: "Allowances (₹)", type: "number", min: 0, step: 0.01 },
      { key: "deductions", label: "Standard deductions (₹)", type: "number", min: 0, step: 0.01 }
    ]
  },
  {
    slug: "appraisal-criteria",
    collection: "appraisal_criteria",
    title: "Appraisal Criteria",
    description: "Weighted criteria used in staff appraisal cycles.",
    module: "payroll",
    sortBy: "name",
    fields: [
      { key: "name", label: "Criterion", type: "text", required: true },
      { key: "weight", label: "Weight (%)", type: "number", required: true, min: 0, max: 100, step: 0.01 },
      { key: "description", label: "Description", type: "textarea", hideInTable: true }
    ]
  },
  {
    slug: "fee-types",
    collection: "fee_types",
    title: "Fee Types",
    description: "Individual fee heads that can be attached to fee structures.",
    module: "fees",
    sortBy: "name",
    fields: [
      { key: "name", label: "Fee type", type: "text", required: true, placeholder: "Tuition" },
      { key: "category", label: "Category", type: "select", required: true, options: CATEGORIES },
      { key: "description", label: "Description", type: "textarea", hideInTable: true }
    ]
  },
  {
    slug: "fee-groups",
    collection: "fee_groups",
    title: "Fee Groups",
    description: "Bundle fee types into groups for quick assignment.",
    module: "fees",
    sortBy: "name",
    fields: [
      { key: "name", label: "Group", type: "text", required: true },
      { key: "description", label: "Description", type: "textarea", hideInTable: true }
    ]
  },
  {
    slug: "income-heads",
    collection: "income_heads",
    title: "Income Heads",
    description: "Chart of income categories for the accounts ledger.",
    module: "fees",
    sortBy: "name",
    fields: [
      { key: "name", label: "Income head", type: "text", required: true },
      { key: "code", label: "Code", type: "text", max: 20 }
    ]
  },
  {
    slug: "expense-heads",
    collection: "expense_heads",
    title: "Expense Heads",
    description: "Chart of expense categories for the accounts ledger.",
    module: "fees",
    sortBy: "name",
    fields: [
      { key: "name", label: "Expense head", type: "text", required: true },
      { key: "code", label: "Code", type: "text", max: 20 }
    ]
  },
  {
    slug: "bank-accounts",
    collection: "bank_accounts",
    title: "Bank Accounts",
    description: "School bank accounts used for deposits and reconciliation.",
    module: "fees",
    sortBy: "name",
    fields: [
      { key: "name", label: "Account name", type: "text", required: true },
      { key: "accountNumber", label: "Account number", type: "text", required: true, max: 30 },
      { key: "ifsc", label: "IFSC", type: "text", max: 15 },
      { key: "branch", label: "Branch", type: "text", hideInTable: true },
      { key: "openingBalance", label: "Opening balance (₹)", type: "number", min: 0, step: 0.01 }
    ]
  },
  {
    slug: "student-houses",
    collection: "student_houses",
    title: "Student Houses",
    description: "House system used for sports and cocurricular grouping.",
    module: "students",
    sortBy: "name",
    fields: [
      { key: "name", label: "House", type: "text", required: true, placeholder: "Blue House" },
      { key: "colour", label: "Colour", type: "text", placeholder: "Blue" },
      { key: "housemaster", label: "Housemaster", type: "text" },
      { key: "motto", label: "Motto", type: "text", hideInTable: true }
    ]
  },
  {
    slug: "student-categories",
    collection: "student_categories",
    title: "Student Categories",
    description: "Admission categories such as RTE, staff ward or sibling.",
    module: "students",
    sortBy: "name",
    fields: [
      { key: "name", label: "Category", type: "text", required: true },
      { key: "concessionPercent", label: "Default concession (%)", type: "number", min: 0, max: 100, step: 0.01 },
      { key: "description", label: "Description", type: "textarea", hideInTable: true }
    ]
  },
  {
    slug: "buildings",
    collection: "buildings",
    title: "Buildings & Blocks",
    description: "Campus buildings that contain classrooms.",
    module: "academics",
    sortBy: "name",
    fields: [
      { key: "name", label: "Building", type: "text", required: true },
      { key: "floors", label: "Floors", type: "number", min: 1, max: 20 },
      { key: "notes", label: "Notes", type: "textarea", hideInTable: true }
    ]
  },
  {
    slug: "id-card-designs",
    collection: "id_card_designs",
    title: "ID Card Designs",
    description: "Templates used when printing student and staff ID cards.",
    module: "students",
    sortBy: "name",
    fields: [
      { key: "name", label: "Design", type: "text", required: true },
      { key: "template", label: "Template", type: "select", required: true, options: ID_TEMPLATES },
      { key: "orientation", label: "Orientation", type: "select", required: true, options: ID_ORIENTATIONS },
      { key: "notes", label: "Notes", type: "textarea", hideInTable: true }
    ]
  },
  {
    slug: "compliance-packs",
    collection: "compliance_packs",
    title: "Compliance Packs",
    description: "Grouped compliance requirements (CBSE affiliation, fire safety…).",
    module: "settings",
    sortBy: "name",
    fields: [
      { key: "name", label: "Pack", type: "text", required: true },
      { key: "description", label: "Description", type: "textarea", hideInTable: true }
    ]
  },
  {
    slug: "survey-templates",
    collection: "survey_templates",
    title: "Survey Templates",
    description: "Reusable survey definitions sent to parents, students or staff.",
    module: "communication",
    sortBy: "name",
    fields: [
      { key: "name", label: "Survey", type: "text", required: true },
      { key: "audience", label: "Audience", type: "select", required: true, options: AUDIENCES },
      { key: "description", label: "Description", type: "textarea", hideInTable: true }
    ]
  },
  {
    slug: "staff-loans",
    collection: "staff_loans",
    title: "Staff Loans & Advances",
    description: "Salary advances and loans issued to staff, with recovery status.",
    module: "payroll",
    sortBy: "employeeName",
    fields: [
      { key: "employeeName", label: "Employee", type: "text", required: true, placeholder: "Full name" },
      { key: "employeeId", label: "Employee ID", type: "text", hideInTable: true },
      { key: "amount", label: "Loan amount (₹)", type: "number", required: true, min: 0, step: 0.01 },
      { key: "installments", label: "Installments", type: "number", min: 1, max: 60 },
      { key: "monthlyDeduction", label: "Monthly deduction (₹)", type: "number", min: 0, step: 0.01 },
      { key: "startDate", label: "Start date", type: "date", required: true },
      {
        key: "status",
        label: "Status",
        type: "select",
        required: true,
        options: [
          { value: "active", label: "Active" },
          { value: "repaid", label: "Repaid" },
          { value: "written_off", label: "Written off" }
        ]
      },
      { key: "reason", label: "Reason", type: "textarea", hideInTable: true }
    ]
  },
  {
    slug: "appraisals",
    collection: "appraisals",
    title: "Staff Appraisals",
    description: "Appraisal cycle results and remarks for each staff member.",
    module: "payroll",
    sortBy: "employeeName",
    fields: [
      { key: "employeeName", label: "Employee", type: "text", required: true },
      { key: "cycle", label: "Cycle", type: "text", required: true, placeholder: "2025-26" },
      { key: "rating", label: "Rating (1-5)", type: "number", min: 1, max: 5, step: 0.1 },
      {
        key: "status",
        label: "Status",
        type: "select",
        required: true,
        options: [
          { value: "draft", label: "Draft" },
          { value: "submitted", label: "Submitted" },
          { value: "finalized", label: "Finalized" }
        ]
      },
      { key: "reviewer", label: "Reviewer", type: "text" },
      { key: "remarks", label: "Remarks", type: "textarea", hideInTable: true }
    ]
  },
  {
    slug: "classrooms",
    collection: "classrooms",
    title: "Classrooms",
    description: "Rooms, labs and halls available for timetabling and bookings.",
    module: "academics",
    sortBy: "name",
    fields: [
      { key: "name", label: "Room", type: "text", required: true, placeholder: "Room 101" },
      { key: "building", label: "Building", type: "text" },
      { key: "floor", label: "Floor", type: "text" },
      { key: "capacity", label: "Capacity", type: "number", min: 0, max: 500 },
      {
        key: "type",
        label: "Type",
        type: "select",
        required: true,
        options: [
          { value: "classroom", label: "Classroom" },
          { value: "lab", label: "Laboratory" },
          { value: "library", label: "Library" },
          { value: "hall", label: "Auditorium / Hall" },
          { value: "sports", label: "Sports area" }
        ]
      },
      {
        key: "status",
        label: "Status",
        type: "select",
        required: true,
        options: [
          { value: "available", label: "Available" },
          { value: "occupied", label: "Occupied" },
          { value: "maintenance", label: "Under maintenance" }
        ]
      }
    ]
  },
  {
    slug: "compliance-items",
    collection: "compliance_items",
    title: "Compliance Checklist",
    description: "Affiliation, safety and statutory items with due dates and owners.",
    module: "settings",
    sortBy: "dueDate",
    fields: [
      { key: "title", label: "Compliance item", type: "text", required: true },
      { key: "category", label: "Category", type: "text", placeholder: "Fire safety" },
      { key: "dueDate", label: "Due date", type: "date", required: true },
      {
        key: "status",
        label: "Status",
        type: "select",
        required: true,
        options: [
          { value: "pending", label: "Pending" },
          { value: "in_progress", label: "In progress" },
          { value: "done", label: "Completed" }
        ]
      },
      { key: "owner", label: "Owner", type: "text" },
      { key: "notes", label: "Notes", type: "textarea", hideInTable: true }
    ]
  },
  {
    slug: "surveys",
    collection: "surveys",
    title: "Surveys",
    description: "Live surveys with audience, window and response target.",
    module: "communication",
    sortBy: "name",
    fields: [
      { key: "name", label: "Survey", type: "text", required: true },
      { key: "template", label: "Template", type: "text" },
      { key: "audience", label: "Audience", type: "select", required: true, options: AUDIENCES },
      { key: "startDate", label: "Opens", type: "date", required: true },
      { key: "endDate", label: "Closes", type: "date", required: true },
      {
        key: "status",
        label: "Status",
        type: "select",
        required: true,
        options: [
          { value: "draft", label: "Draft" },
          { value: "live", label: "Live" },
          { value: "closed", label: "Closed" }
        ]
      }
    ]
  },
  {
    slug: "assessments",
    collection: "assessments",
    title: "Competency Assessments",
    description: "Skill and competency assessments with class, subject and marks.",
    module: "exams",
    sortBy: "name",
    fields: [
      { key: "name", label: "Assessment", type: "text", required: true },
      { key: "type", label: "Type", type: "text", placeholder: "Reading fluency" },
      { key: "className", label: "Class", type: "text" },
      { key: "section", label: "Section", type: "text" },
      { key: "subject", label: "Subject", type: "text" },
      { key: "date", label: "Date", type: "date", required: true },
      { key: "maxMarks", label: "Max marks", type: "number", min: 1, max: 1000 },
      {
        key: "status",
        label: "Status",
        type: "select",
        required: true,
        options: [
          { value: "planned", label: "Planned" },
          { value: "conducted", label: "Conducted" },
          { value: "published", label: "Published" }
        ]
      }
    ]
  },
  {
    slug: "gallery-albums",
    collection: "gallery_albums",
    title: "Photo Gallery",
    description: "Albums shared with parents on the portal and app.",
    module: "communication",
    sortBy: "title",
    fields: [
      { key: "title", label: "Album title", type: "text", required: true },
      { key: "category", label: "Category", type: "text", placeholder: "Annual Day" },
      { key: "eventDate", label: "Event date", type: "date", required: true },
      { key: "coverUrl", label: "Cover image URL", type: "text", hideInTable: true },
      { key: "photoUrls", label: "Photo URLs (comma separated)", type: "textarea", hideInTable: true },
      {
        key: "visibility",
        label: "Visible to",
        type: "select",
        required: true,
        options: [
          { value: "parents", label: "Parents" },
          { value: "staff", label: "Staff only" },
          { value: "public", label: "Everyone" }
        ]
      }
    ]
  },
  {
    slug: "qr-sessions",
    collection: "qr_sessions",
    title: "QR Attendance Sessions",
    description: "Generate rotating QR codes for self-service student check-in.",
    module: "attendance",
    sortBy: "date",
    fields: [
      { key: "className", label: "Class", type: "text", required: true, placeholder: "Class 6" },
      { key: "section", label: "Section", type: "text" },
      { key: "date", label: "Date", type: "date", required: true },
      { key: "token", label: "Session code", type: "text", placeholder: "Auto-generated if blank" },
      { key: "validUntil", label: "Valid until", type: "text", placeholder: "09:15" },
      {
        key: "mode",
        label: "Mode",
        type: "select",
        required: true,
        options: [
          { value: "check_in", label: "Check-in" },
          { value: "check_out", label: "Check-out" },
          { value: "both", label: "Check-in & check-out" }
        ]
      },
      {
        key: "status",
        label: "Status",
        type: "select",
        required: true,
        options: [
          { value: "open", label: "Open" },
          { value: "closed", label: "Closed" }
        ]
      }
    ]
  },
  {
    slug: "ptm-meetings",
    collection: "ptm_meetings",
    title: "PTM Meetings",
    description: "Parent-teacher meeting slots and their status.",
    module: "communication",
    sortBy: "date",
    fields: [
      { key: "title", label: "Meeting", type: "text", required: true, placeholder: "Term 1 PTM" },
      { key: "date", label: "Date", type: "date", required: true },
      { key: "startTime", label: "Start time", type: "text", placeholder: "09:00" },
      { key: "endTime", label: "End time", type: "text", placeholder: "13:00" },
      { key: "classes", label: "Classes", type: "text", placeholder: "All or Class 6, Class 7" },
      {
        key: "status",
        label: "Status",
        type: "select",
        required: true,
        options: [
          { value: "scheduled", label: "Scheduled" },
          { value: "ongoing", label: "Ongoing" },
          { value: "completed", label: "Completed" },
          { value: "cancelled", label: "Cancelled" }
        ]
      }
    ]
  },
  {
    slug: "ptm-records",
    collection: "ptm_records",
    title: "PTM Notes",
    description: "Discussion notes and follow-ups captured during each PTM.",
    module: "communication",
    sortBy: "date",
    fields: [
      { key: "meetingTitle", label: "Meeting", type: "text", required: true },
      { key: "studentName", label: "Student", type: "text", required: true },
      { key: "parentName", label: "Parent", type: "text" },
      { key: "teacherName", label: "Teacher", type: "text" },
      { key: "date", label: "Date", type: "date", required: true },
      { key: "notes", label: "Discussion notes", type: "textarea", hideInTable: true },
      { key: "followUp", label: "Follow-up", type: "text" },
      {
        key: "status",
        label: "Status",
        type: "select",
        required: true,
        options: [
          { value: "open", label: "Open" },
          { value: "resolved", label: "Resolved" }
        ]
      }
    ]
  },
  {
    slug: "lesson-plans",
    collection: "lesson_plans",
    title: "Lesson Plans",
    description: "Daily lesson plans with topics, objectives and completion status.",
    module: "academics",
    sortBy: "date",
    fields: [
      { key: "className", label: "Class", type: "text", required: true },
      { key: "section", label: "Section", type: "text" },
      { key: "subject", label: "Subject", type: "text", required: true },
      { key: "topic", label: "Topic", type: "text", required: true },
      { key: "date", label: "Date", type: "date", required: true },
      { key: "teacherName", label: "Teacher", type: "text" },
      { key: "objectives", label: "Objectives", type: "textarea", hideInTable: true },
      {
        key: "status",
        label: "Status",
        type: "select",
        required: true,
        options: [
          { value: "planned", label: "Planned" },
          { value: "completed", label: "Completed" },
          { value: "reviewed", label: "Reviewed" }
        ]
      }
    ]
  },
  {
    slug: "exam-schedules",
    collection: "exam_schedules",
    title: "Exam Datesheet",
    description: "Subject-wise exam schedule with date, time and room.",
    module: "exams",
    sortBy: "examDate",
    fields: [
      { key: "examName", label: "Exam", type: "text", required: true, placeholder: "Term 1" },
      { key: "className", label: "Class", type: "text", required: true },
      { key: "subject", label: "Subject", type: "text", required: true },
      { key: "examDate", label: "Exam date", type: "date", required: true },
      { key: "startTime", label: "Start time", type: "text", placeholder: "09:00" },
      { key: "endTime", label: "End time", type: "text", placeholder: "11:00" },
      { key: "room", label: "Room", type: "text" },
      { key: "maxMarks", label: "Max marks", type: "number", min: 1, max: 1000 }
    ]
  },
  {
    slug: "exam-remarks",
    collection: "exam_remarks",
    title: "Teacher Exam Remarks",
    description: "Subject-wise remarks recorded by teachers for report cards.",
    module: "exams",
    sortBy: "date",
    fields: [
      { key: "examName", label: "Exam", type: "text", required: true },
      { key: "studentName", label: "Student", type: "text", required: true },
      { key: "subject", label: "Subject", type: "text" },
      { key: "teacherName", label: "Teacher", type: "text" },
      { key: "date", label: "Date", type: "date", required: true },
      { key: "remark", label: "Remark", type: "textarea", required: true, hideInTable: true }
    ]
  },
  {
    slug: "custom-fields",
    collection: "custom_fields",
    title: "Custom Fields",
    description: "Extra admission/profile fields surfaced on forms for students or staff.",
    module: "settings",
    sortBy: "label",
    fields: [
      { key: "label", label: "Field label", type: "text", required: true },
      {
        key: "entity",
        label: "Applies to",
        type: "select",
        required: true,
        options: [
          { value: "student", label: "Students" },
          { value: "staff", label: "Staff" },
          { value: "parent", label: "Parents" }
        ]
      },
      {
        key: "type",
        label: "Field type",
        type: "select",
        required: true,
        options: [
          { value: "text", label: "Text" },
          { value: "number", label: "Number" },
          { value: "date", label: "Date" },
          { value: "select", label: "Dropdown" }
        ]
      },
      { key: "options", label: "Dropdown options", type: "text", hideInTable: true },
      { key: "required", label: "Required", type: "boolean" }
    ]
  },
  {
    slug: "module-toggles",
    collection: "module_toggles",
    title: "Module Settings",
    description: "Turn optional modules on or off for this school.",
    module: "settings",
    sortBy: "moduleName",
    fields: [
      { key: "moduleName", label: "Module", type: "text", required: true, placeholder: "Hostel" },
      { key: "enabled", label: "Enabled", type: "boolean" },
      { key: "notes", label: "Notes", type: "textarea", hideInTable: true }
    ]
  },
  {
    slug: "payment-gateways",
    collection: "payment_gateways",
    title: "Payment Gateways",
    description: "Online fee collection providers and their mode (test/live).",
    module: "settings",
    sortBy: "provider",
    fields: [
      {
        key: "provider",
        label: "Provider",
        type: "select",
        required: true,
        options: [
          { value: "razorpay", label: "Razorpay" },
          { value: "payu", label: "PayU" },
          { value: "stripe", label: "Stripe" },
          { value: "manual", label: "Manual / UPI" }
        ]
      },
      { key: "keyId", label: "Key ID", type: "text", placeholder: "rzp_test_…" },
      { key: "accountName", label: "Account name", type: "text" },
      {
        key: "mode",
        label: "Mode",
        type: "select",
        required: true,
        options: [
          { value: "test", label: "Test" },
          { value: "live", label: "Live" }
        ]
      },
      { key: "enabled", label: "Enabled", type: "boolean" }
    ]
  },
  {
    slug: "subscription-plans",
    collection: "subscription_plans",
    title: "Subscription Plans",
    description: "ERP plan assigned to this school with billing cycle and limits.",
    module: "settings",
    sortBy: "plan",
    fields: [
      { key: "plan", label: "Plan", type: "text", required: true, placeholder: "Standard" },
      { key: "price", label: "Price (₹)", type: "number", min: 0, step: 0.01 },
      {
        key: "billingCycle",
        label: "Billing cycle",
        type: "select",
        required: true,
        options: [
          { value: "monthly", label: "Monthly" },
          { value: "quarterly", label: "Quarterly" },
          { value: "yearly", label: "Yearly" }
        ]
      },
      { key: "studentLimit", label: "Student limit", type: "number", min: 0 },
      {
        key: "status",
        label: "Status",
        type: "select",
        required: true,
        options: [
          { value: "active", label: "Active" },
          { value: "expired", label: "Expired" },
          { value: "trial", label: "Trial" }
        ]
      }
    ]
  }
];

export function getMasterConfig(slug: string): MasterConfig | undefined {
  return MASTER_CONFIGS.find((config) => config.slug === slug);
}
