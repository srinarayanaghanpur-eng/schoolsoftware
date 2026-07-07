export const SYSTEM_PROMPT =
  "You are the ERP AI assistant for Sri Narayana High School. You are helpful, practical, and safe. You must never invent student fees, due amounts, mobile numbers, attendance, or payment data. If ERP data is needed, use only data provided by backend tools. For fee reminders, use the school's fixed reminder template unless admin asks for a notice draft. Keep parent messages polite and simple. Do not recommend unsafe browser automation for WhatsApp Web or Google Messages. For automatic messaging, use official API-based channels only.";

export const FEE_REMINDER_TEMPLATE = `Dear {{parentName}},

This is a fee reminder from Sri Narayana High School.
Fee due for {{studentName}} of Class {{className}}{{sectionText}} is Rs {{dueAmount}} for {{feeType}}.

Kindly clear the due amount as early as possible.

Thank you,
Sri Narayana High School`;

export function buildNoticePrompt(input: {
  topic: string;
  language: "English" | "Telugu" | "Both";
  tone: "formal" | "simple" | "premium";
  target: "parents" | "students" | "teachers";
}): string {
  return `Generate a school notice for ${input.target} at Sri Narayana High School.

Topic: ${input.topic}
Language: ${input.language}
Tone: ${input.tone}
Target audience: ${input.target}

The notice should be clear, professional, and appropriate for the target audience. Include the school name and a proper notice format. Sign it as "Sri Narayana High School Administration".`;
}

export function buildParentMessagePrompt(input: {
  topic: string;
  details?: string;
  language?: string;
}): string {
  return `Write a polite parent message from Sri Narayana High School.

Topic: ${input.topic}
${input.details ? `Details: ${input.details}` : ""}
${input.language ? `Language: ${input.language}` : ""}

Keep the message respectful, clear, and professional. Sign it as "Sri Narayana High School".`;
}

export function buildTeacherMessagePrompt(input: {
  topic: string;
  details?: string;
}): string {
  return `Write a professional message for teachers at Sri Narayana High School.

Topic: ${input.topic}
${input.details ? `Details: ${input.details}` : ""}

Keep it clear and professional. Sign it as "Administration".`;
}

export function buildReportExplainerPrompt(reportData: string): string {
  return `Explain the following ERP report from Sri Narayana High School in simple, plain English:

${reportData}

Provide a clear summary, key takeaways, and actionable insights.`;
}

export function buildDuesSummaryPrompt(duesData: string): string {
  return `Summarize the following fee dues data from Sri Narayana High School ERP:

${duesData}

Provide:
1. Total number of students with dues
2. Total due amount
3. Class-wise breakdown
4. Top due cases
5. Suggested reminder plan

Only use the data provided. Do not invent any amounts or student names.`;
}
