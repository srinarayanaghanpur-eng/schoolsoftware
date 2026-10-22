// Styled field/section primitives used by the A4 admission sheet.
import { type ReactNode } from "react";
import { display } from "./formatters";

// ---------- Styled sub-components ----------

export function FieldBox({
  label,
  value,
  wide = false,
}: {
  label: string;
  value: unknown;
  wide?: boolean;
}) {
  return (
    <div className={wide ? "af-field af-field-wide" : "af-field"}>
      <span className="af-label">{label}</span>
      <span className="af-value">{display(value)}</span>
    </div>
  );
}

export function FormSection({
  number,
  title,
  children,
  cols = 3,
}: {
  number: number;
  title: string;
  children: ReactNode;
  cols?: 2 | 3;
}) {
  return (
    <div className="af-section">
      <div className="af-section-heading">
        <span className="af-section-number">{String(number).padStart(2, "0")}</span>
        <span>{title}</span>
      </div>
      <div className={cols === 2 ? "af-grid af-grid-2" : "af-grid af-grid-3"}>
        {children}
      </div>
    </div>
  );
}

export function ChecklistItem({
  label,
  checked,
}: {
  label: string;
  checked?: boolean;
}) {
  return (
    <label className="af-check-item">
      <span className="af-check-box">
        {checked && <span className="af-check-tick">✓</span>}
      </span>
      <span className="af-check-label">{label}</span>
    </label>
  );
}

export function SignatureLine({ title }: { title: string }) {
  return (
    <div className="af-signature">
      <div className="af-signature-line" />
      <span className="af-signature-title">{title}</span>
      <span className="af-signature-title">Date: ____________</span>
    </div>
  );
}

export function DataRow({
  label,
  value,
  labelWidth = 140,
}: {
  label: string;
  value: unknown;
  labelWidth?: number;
}) {
  return (
    <div className="af-data-row">
      <span className="af-data-label" style={{ minWidth: labelWidth }}>
        {label}
      </span>
      <span className="af-data-sep">:</span>
      <span className="af-data-value">{display(value)}</span>
    </div>
  );
}