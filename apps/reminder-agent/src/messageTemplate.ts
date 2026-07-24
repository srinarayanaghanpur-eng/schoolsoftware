/**
 * Renders the reminder message for a queue item. If the ERP already stored a
 * `message`, that wins (single source of truth). Otherwise we render from the
 * settings template using {{variable}} tokens.
 */
import type { QueueItem, AgentSettings } from './types.js';

export function formatCurrency(amount: number): string {
  return `₹${Number(amount || 0).toLocaleString('en-IN')}`;
}

export function dueAmountOf(item: QueueItem): number {
  return Number(item.dueAmount ?? item.totalDue ?? 0);
}

function classLabel(item: QueueItem): string {
  const section = item.section ? `-${item.section}` : '';
  return `${item.className ?? ''}${section}`.trim();
}

/** Render a template with {{token}} placeholders. Unknown tokens become ''. */
export function renderTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, key: string) => vars[key] ?? '');
}

export function buildMessage(item: QueueItem, settings: AgentSettings): string {
  if (item.message && item.message.trim()) return item.message.trim();

  const vars: Record<string, string> = {
    parentName: item.parentName?.trim() || 'Parent',
    studentName: item.studentName || 'Student',
    className: classLabel(item),
    class: classLabel(item),
    feeType: item.feeType || 'Fee',
    amount: formatCurrency(dueAmountOf(item)),
    dueAmount: formatCurrency(dueAmountOf(item)),
    dueDate: item.dueDate || '',
    schoolName: item.schoolName || settings.schoolName || 'Sri Narayana High School',
    supportPhone: item.supportPhone || settings.supportPhone || '',
  };

  const template =
    settings.messageTemplate?.trim() ||
    [
      'Dear {{parentName}},',
      'This is a gentle reminder that {{dueAmount}} is pending towards {{feeType}} for your child {{studentName}}, Class {{className}}.',
      'Kindly make the payment.',
      'If payment has already been made, please ignore this message.',
      'Thank you.',
      '{{schoolName}}',
    ].join('\n');

  return renderTemplate(template, vars).trim();
}
