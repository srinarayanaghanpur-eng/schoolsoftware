"use client";

import { Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useAcademicYears } from "@/components/AcademicYearContext";
import { DatePicker } from "@/components/DatePicker";

type DateRange = { from: string; to: string };

type DateRangeFilterProps = {
  from: string;
  to: string;
  onChange: (range: DateRange) => void;
  onApply: (range: DateRange) => void;
  loading?: boolean;
  className?: string;
  rightSlot?: ReactNode;
};

const INPUT_HINT = "DD-MM-YYYY";

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function isoFromLocalDate(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function displayFromIso(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : "";
}

function normalizeTypedDate(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}-${digits.slice(2)}`;
  return `${digits.slice(0, 2)}-${digits.slice(2, 4)}-${digits.slice(4)}`;
}

function parseDisplayDate(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const match = /^(\d{2})-(\d{2})-(\d{4})$/.exec(trimmed);
  if (!match) return null;

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }
  return isoFromLocalDate(date);
}

function rangeForPreset(preset: string, activeYear?: { startDate: string; endDate: string } | null): DateRange {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  if (preset === "today") return { from: isoFromLocalDate(today), to: isoFromLocalDate(today) };
  if (preset === "yesterday") return { from: isoFromLocalDate(yesterday), to: isoFromLocalDate(yesterday) };

  if (preset === "week") {
    const start = new Date(today);
    const day = start.getDay();
    start.setDate(today.getDate() - (day === 0 ? 6 : day - 1));
    return { from: isoFromLocalDate(start), to: isoFromLocalDate(today) };
  }

  if (preset === "month") {
    return { from: isoFromLocalDate(new Date(today.getFullYear(), today.getMonth(), 1)), to: isoFromLocalDate(today) };
  }

  if (preset === "lastMonth") {
    const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const end = new Date(today.getFullYear(), today.getMonth(), 0);
    return { from: isoFromLocalDate(start), to: isoFromLocalDate(end) };
  }

  if (preset === "academicYear" && activeYear) {
    return { from: activeYear.startDate, to: activeYear.endDate };
  }

  return { from: "", to: "" };
}

export function formatDateForDisplay(value: string) {
  return displayFromIso(value);
}

export function DateRangeFilter({ from, to, onChange, onApply, loading, className = "", rightSlot }: DateRangeFilterProps) {
  const { activeYear } = useAcademicYears();
  const [fromText, setFromText] = useState(displayFromIso(from));
  const [toText, setToText] = useState(displayFromIso(to));
  const [error, setError] = useState("");

  useEffect(() => {
    setFromText(displayFromIso(from));
  }, [from]);

  useEffect(() => {
    setToText(displayFromIso(to));
  }, [to]);

  const selectedLabel = useMemo(() => {
    const start = displayFromIso(from);
    const end = displayFromIso(to);
    if (start && end) return `${start} to ${end}`;
    return start || end || "No date filter";
  }, [from, to]);

  function commit(nextFromText = fromText, nextToText = toText) {
    const parsedFrom = parseDisplayDate(nextFromText);
    const parsedTo = parseDisplayDate(nextToText);

    if (parsedFrom === null || parsedTo === null) {
      setError(`Enter dates in ${INPUT_HINT} format.`);
      return null;
    }
    if (parsedFrom && parsedTo && parsedFrom > parsedTo) {
      setError("From date cannot be after To date.");
      return null;
    }

    const next = { from: parsedFrom, to: parsedTo };
    setError("");
    setFromText(displayFromIso(next.from));
    setToText(displayFromIso(next.to));
    onChange(next);
    return next;
  }

  function apply() {
    const next = commit();
    if (next) onApply(next);
  }

  function setPreset(preset: string) {
    const next = rangeForPreset(preset, activeYear);
    setError("");
    setFromText(displayFromIso(next.from));
    setToText(displayFromIso(next.to));
    onChange(next);
  }

  const quickButtons = [
    ["today", "Today"],
    ["yesterday", "Yesterday"],
    ["week", "This Week"],
    ["month", "This Month"],
    ["lastMonth", "Last Month"],
    ["academicYear", "Academic Year"]
  ] as const;

  return (
    <div className={`card space-y-3 p-4 ${className}`}>
      <div className="flex flex-wrap gap-2">
        {quickButtons.map(([value, label]) => (
          <button
            key={value}
            type="button"
            className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-bold text-foreground transition hover:border-ring/50 hover:bg-muted hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => setPreset(value)}
            disabled={value === "academicYear" && !activeYear}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
        <DateTextField label="From Date" value={fromText} onTextChange={setFromText} onIsoChange={(value) => commit(displayFromIso(value), toText)} />
        <DateTextField label="To Date" value={toText} onTextChange={setToText} onIsoChange={(value) => commit(fromText, displayFromIso(value))} />
        <button type="button" className="btn-primary h-[42px] shrink-0" onClick={apply} disabled={loading}>
          <Search size={16} />
          Apply
        </button>
        {rightSlot && <div className="lg:ml-auto">{rightSlot}</div>}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold">
        <span className="text-muted-foreground">Selected: <span className="text-foreground">{selectedLabel}</span></span>
        {error && <span className="text-[#ed515d]">{error}</span>}
      </div>
    </div>
  );
}

function DateTextField({
  label,
  value,
  onTextChange,
  onIsoChange
}: {
  label: string;
  value: string;
  onTextChange: (value: string) => void;
  onIsoChange: (value: string) => void;
}) {
  return (
    <label className="min-w-0 flex-1 text-sm font-semibold text-foreground">
      {label}
      <span className="relative mt-1 block">
        <input
          className="field pr-11"
          inputMode="numeric"
          placeholder={INPUT_HINT}
          value={value}
          onChange={(event) => onTextChange(normalizeTypedDate(event.target.value))}
          onBlur={() => {
            const parsed = parseDisplayDate(value);
            if (parsed) onTextChange(displayFromIso(parsed));
          }}
        />
        <span className="absolute right-1.5 top-1/2 -translate-y-1/2">
          <DatePicker
            iconOnly
            ariaLabel={`${label} calendar`}
            value={parseDisplayDate(value) || ""}
            onChange={(event) => {
              if (event.target.value) onIsoChange(event.target.value);
            }}
          />
        </span>
      </span>
    </label>
  );
}
