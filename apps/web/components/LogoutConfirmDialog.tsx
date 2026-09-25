"use client";

import { LogOut } from "lucide-react";
import OverlayPortal from "@/components/OverlayPortal";

export default function LogoutConfirmDialog({
  open,
  busy,
  onCancel,
  onConfirm
}: {
  open: boolean;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!open) return null;
  return (
    <OverlayPortal>
    <div
      className="fixed inset-0 z-[100] grid place-items-center bg-black/45 p-4"
      onClick={onCancel}
      role="presentation"
    >
      <div
        className="card w-full max-w-sm p-6"
        onClick={(e) => e.stopPropagation()}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="logout-confirm-title"
        aria-describedby="logout-confirm-desc"
      >
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#ffebed] text-[#ed515d]">
            <LogOut size={18} />
          </span>
          <h2 id="logout-confirm-title" className="text-base font-extrabold text-[#1f2136]">
            Log out?
          </h2>
        </div>
        <p id="logout-confirm-desc" className="mt-3 text-sm font-medium text-[#5f6888]">
          Are you sure you want to log out?
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onCancel} disabled={busy} autoFocus>
            Cancel
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#ed515d] px-4 py-2 text-sm font-bold text-white hover:bg-[#d8434f] disabled:opacity-60"
            onClick={onConfirm}
            disabled={busy}
          >
            <LogOut size={15} /> {busy ? "Logging out…" : "Log out"}
          </button>
        </div>
      </div>
    </div>
    </OverlayPortal>
  );
}
