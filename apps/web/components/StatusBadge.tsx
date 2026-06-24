import clsx from "clsx";
import { memo } from "react";
import { ATTENDANCE_COLORS, type AttendanceStatus } from "@sri-narayana/shared";

const labelMap: Record<AttendanceStatus, string> = {
  present: "Present",
  late: "Late",
  cl: "CL",
  holiday: "Holiday",
  absent: "Absent",
  not_marked: "Not marked"
};

function StatusBadgeInner({ status }: { status: AttendanceStatus }) {
  return (
    <span className={clsx("inline-flex rounded px-2 py-1 text-xs font-medium", ATTENDANCE_COLORS[status])}>
      {labelMap[status]}
    </span>
  );
}

export const StatusBadge = memo(StatusBadgeInner);
