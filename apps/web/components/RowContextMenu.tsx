"use client";

import { useEffect, useState } from "react";
import OverlayPortal from "@/components/OverlayPortal";

export type ContextMenuItem = {
  label: string;
  icon?: React.ReactNode;
  disabled?: boolean;
  danger?: boolean;
  onSelect: () => void;
};

/**
 * Right-click context menu. Render once per list; open it from a row's
 * onContextMenu with the row's actions. Closes on click elsewhere, scroll,
 * resize or Escape. Position is clamped to the viewport so the menu itself
 * never gets cut off.
 */
export default function RowContextMenu({
  menu,
  onClose
}: {
  menu: { x: number; y: number; items: ContextMenuItem[] } | null;
  onClose: () => void;
}) {
  const [pos, setPos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (!menu) return;
    const MENU_W = 220;
    const MENU_H = menu.items.length * 40 + 16;
    setPos({
      x: Math.max(8, Math.min(menu.x, window.innerWidth - MENU_W - 8)),
      y: Math.max(8, Math.min(menu.y, window.innerHeight - MENU_H - 8))
    });
    const close = () => onClose();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
      window.removeEventListener("keydown", onKey);
    };
  }, [menu, onClose]);

  if (!menu) return null;

  return (
    <OverlayPortal>
    <div className="fixed inset-0 z-[90]" onClick={onClose} onContextMenu={(e) => e.preventDefault()}>
      <div
        className="fixed min-w-[200px] rounded-xl border border-[#e2e8f0] bg-white p-1.5 shadow-xl"
        style={{ left: pos.x, top: pos.y }}
        role="menu"
        onClick={(e) => e.stopPropagation()}
      >
        {menu.items.map((item, i) => (
          <button
            key={i}
            type="button"
            role="menuitem"
            disabled={item.disabled}
            onClick={() => {
              onClose();
              item.onSelect();
            }}
            className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
              item.danger ? "text-[#dc2626] hover:bg-[#fef2f2]" : "text-[#1e293b] hover:bg-[#f1f5f9]"
            }`}
          >
            {item.icon}
            {item.label}
          </button>
        ))}
      </div>
    </div>
    </OverlayPortal>
  );
}
