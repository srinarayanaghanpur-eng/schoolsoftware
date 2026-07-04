"use client";

import { type ReactNode } from "react";

/**
 * A column definition for {@link ResponsiveTable}.
 * - `header`   column title (table head + card label)
 * - `cell`     renders the value for a row
 * - `primary`  marks the 1–2 fields shown as the card's bold title on mobile
 * - `hideLabelOnCard` drop the "Label:" prefix on the mobile card (for the title / actions)
 * - `className`/`thClassName` optional cell / header classes (desktop table only)
 */
export type Column<T> = {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  primary?: boolean;
  hideLabelOnCard?: boolean;
  align?: "left" | "right" | "center";
  className?: string;
  thClassName?: string;
};

type Props<T> = {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  empty?: ReactNode;
  /** Extra content rendered at the bottom of each mobile card (e.g. an action row). */
  cardFooter?: (row: T) => ReactNode;
  minTableWidth?: number;
};

const alignClass = (a?: "left" | "right" | "center") =>
  a === "right" ? "text-right" : a === "center" ? "text-center" : "text-left";

/**
 * Mobile-first data table. On `md+` it renders a normal horizontally-scrollable
 * table; below `md` each row becomes a stacked card (label/value pairs) so data
 * stays readable on phones instead of a tiny squeezed grid.
 */
export function ResponsiveTable<T>({
  columns,
  rows,
  rowKey,
  onRowClick,
  empty,
  cardFooter,
  minTableWidth = 640,
}: Props<T>) {
  if (rows.length === 0 && empty) {
    return <div className="card p-8 text-center text-sm font-semibold text-muted-foreground">{empty}</div>;
  }

  const primaryCols = columns.filter((c) => c.primary);
  const secondaryCols = columns.filter((c) => !c.primary);

  return (
    <>
      {/* Desktop / tablet: real table, scrolls horizontally only if needed. */}
      <div className="card hidden overflow-hidden md:block">
        <div className="table-scroll">
          <table className="w-full text-left text-sm" style={{ minWidth: minTableWidth }}>
            <thead className="text-xs uppercase">
              <tr>
                {columns.map((c) => (
                  <th key={c.key} className={`px-4 py-3 ${alignClass(c.align)} ${c.thClassName ?? ""}`}>
                    {c.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={rowKey(row)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={`border-t ${onRowClick ? "cursor-pointer" : ""}`}
                >
                  {columns.map((c) => (
                    <td key={c.key} className={`px-4 py-3 ${alignClass(c.align)} ${c.className ?? ""}`}>
                      {c.cell(row)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile: one card per row. */}
      <div className="space-y-3 md:hidden">
        {rows.map((row) => (
          <div
            key={rowKey(row)}
            onClick={onRowClick ? () => onRowClick(row) : undefined}
            className={`card p-4 ${onRowClick ? "cursor-pointer" : ""}`}
          >
            {primaryCols.length > 0 && (
              <div className="mb-2 space-y-0.5">
                {primaryCols.map((c) => (
                  <div key={c.key} className="text-base font-bold text-foreground">
                    {c.cell(row)}
                  </div>
                ))}
              </div>
            )}
            <dl className="grid grid-cols-2 gap-x-3 gap-y-2">
              {secondaryCols.map((c) => (
                <div key={c.key} className="min-w-0">
                  {!c.hideLabelOnCard && (
                    <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{c.header}</dt>
                  )}
                  <dd className="truncate text-sm font-semibold text-foreground">{c.cell(row)}</dd>
                </div>
              ))}
            </dl>
            {cardFooter && <div className="mt-3 border-t border-border pt-3">{cardFooter(row)}</div>}
          </div>
        ))}
      </div>
    </>
  );
}
