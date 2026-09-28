"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import OverlayPortal from "@/components/OverlayPortal";

export type PopupKind = "success" | "error" | "info";

type PopupItem = {
  id: number;
  kind: PopupKind;
  title: string;
  detail?: string;
  confirm?: { okLabel?: string; cancelLabel?: string; danger?: boolean };
  resolve?: (value: boolean) => void;
};

export type PopupApi = {
  success: (title: string, detail?: string) => void;
  error: (title: string, detail?: string) => void;
  info: (title: string, detail?: string) => void;
  /** Centered OK/Cancel confirmation. Resolves true on OK, false on Cancel/backdrop. */
  confirm: (title: string, detail?: string, opts?: { okLabel?: string; cancelLabel?: string; danger?: boolean }) => Promise<boolean>;
};

const PopupContext = createContext<PopupApi | null>(null);

export function usePopup(): PopupApi {
  const api = useContext(PopupContext);
  const fallback = useMemo(
    () => ({ success: () => {}, error: () => {}, info: () => {}, confirm: () => Promise.resolve(false) }),
    []
  );
  if (!api) {
    // Safe fallback outside provider: no-ops instead of crash.
    return fallback;
  }
  return api;
}

const KIND_STYLE: Record<PopupKind, { icon: typeof Info; iconBox: string; okButton: string }> = {
  success: {
    icon: CheckCircle2,
    iconBox: "bg-[#e6f8ef] text-[#0f8d52]",
    okButton: "bg-[#0f8d52] hover:bg-[#0c7343]"
  },
  error: {
    icon: XCircle,
    iconBox: "bg-[#ffebed] text-[#ed515d]",
    okButton: "bg-[#ed515d] hover:bg-[#d8434f]"
  },
  info: {
    icon: Info,
    iconBox: "bg-[#eef0ff] text-[#3033a1]",
    okButton: "bg-[#3033a1] hover:bg-[#20226f]"
  }
};

/**
 * Global centered popup system. One popup at a time (queued), always in the
 * center of the screen with an OK button — used for every success / error /
 * info message across the ERP (saves, deletes, generation, payments, ...).
 */
export function PopupProvider({ children }: { children: ReactNode }) {
  const [queue, setQueue] = useState<PopupItem[]>([]);
  const idRef = useRef(1);

  const dismissCurrent = useCallback(() => {
    setQueue((prev) => {
      const [first, ...rest] = prev;
      first?.resolve?.(false);
      return rest;
    });
  }, []);

  const confirmCurrent = useCallback(() => {
    setQueue((prev) => {
      const [first, ...rest] = prev;
      first?.resolve?.(true);
      return rest;
    });
  }, []);

  const push = useCallback((kind: PopupKind, title: string, detail?: string) => {
    const id = idRef.current++;
    setQueue((prev) => {
      // Identical back-to-back popups (e.g. mount + focus refetch failing
      // together) collapse into one instead of stacking OKs.
      const last = prev[prev.length - 1];
      if (last && !last.confirm && last.kind === kind && last.title === title && last.detail === detail) return prev;
      return [...prev, { id, kind, title, detail }];
    });
  }, []);

  const confirm = useCallback((title: string, detail?: string, opts?: { okLabel?: string; cancelLabel?: string; danger?: boolean }) => {
    const id = idRef.current++;
    return new Promise<boolean>((resolve) => {
      setQueue((prev) => [...prev, { id, kind: "info", title, detail, confirm: opts ?? {}, resolve }]);
    });
  }, []);

  const api = useMemo<PopupApi>(
    () => ({
      success: (title, detail) => push("success", title, detail),
      error: (title, detail) => push("error", title, detail),
      info: (title, detail) => push("info", title, detail),
      confirm
    }),
    [push, confirm]
  );

  const current = queue[0] ?? null;
  const style = current ? KIND_STYLE[current.kind] : null;
  const Icon = style?.icon ?? Info;

  return (
    <PopupContext.Provider value={api}>
      {children}
      {current && style && (
        <OverlayPortal>
          <div
            className="fixed inset-0 z-[200] grid place-items-center bg-black/50 p-4"
            onClick={dismissCurrent}
            role="presentation"
          >
            <div
              className="w-full max-w-sm rounded-2xl border border-[#e2e6f4] bg-white p-6 text-center shadow-2xl"
              onClick={(e) => e.stopPropagation()}
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="center-popup-title"
              aria-describedby={current.detail ? "center-popup-desc" : undefined}
            >
              <span className={`mx-auto grid h-14 w-14 place-items-center rounded-full ${style.iconBox}`}>
                {current.kind === "info" ? <AlertTriangle size={26} /> : <Icon size={26} />}
              </span>
              <h2 id="center-popup-title" className="mt-4 text-lg font-extrabold text-[#1f2136]">
                {current.title}
              </h2>
              {current.detail && (
                <p id="center-popup-desc" className="mx-auto mt-2 max-w-xs break-words text-sm font-medium text-[#5f6888]">
                  {current.detail}
                </p>
              )}
              {queue.length > 1 && (
                <p className="mt-2 text-xs font-bold text-[#8a91b4]">+{queue.length - 1} more</p>
              )}
              {current.confirm ? (
                <div className="mt-5 flex gap-2">
                  <button
                    type="button"
                    onClick={dismissCurrent}
                    className="flex-1 rounded-xl border border-[#e0e3f0] bg-white px-5 py-3 text-sm font-extrabold uppercase tracking-wide text-[#5f6888] transition hover:bg-[#f3f4fb]"
                  >
                    {current.confirm.cancelLabel ?? "Cancel"}
                  </button>
                  <button
                    type="button"
                    autoFocus
                    onClick={confirmCurrent}
                    className={`flex-1 rounded-xl px-5 py-3 text-sm font-extrabold uppercase tracking-wide text-white transition ${
                      current.confirm.danger ? "bg-[#ed515d] hover:bg-[#d8434f]" : style.okButton
                    }`}
                  >
                    {current.confirm.okLabel ?? "OK"}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  autoFocus
                  onClick={dismissCurrent}
                  className={`mt-5 w-full rounded-xl px-5 py-3 text-sm font-extrabold uppercase tracking-wide text-white transition ${style.okButton}`}
                >
                  OK
                </button>
              )}
            </div>
          </div>
        </OverlayPortal>
      )}
    </PopupContext.Provider>
  );
}
