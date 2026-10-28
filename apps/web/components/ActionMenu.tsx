"use client";

import { MoreVertical } from "lucide-react";
import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import type { LucideIcon } from "lucide-react";

export type ActionItem = {
  label: string;
  icon?: LucideIcon;
  onClick: () => void;
  href?: string;
  destructive?: boolean;
  disabled?: boolean;
};

/**
 * Row/card action dropdown. Replaces clusters of tiny icon-only buttons (Edit /
 * Delete / Receipt …) with a single 44px "Actions" trigger + menu — far easier
 * to hit on touch and keeps table rows from overflowing on mobile.
 */
export function ActionMenu({ items, label = "Actions" }: { items: ActionItem[]; label?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const frame = window.requestAnimationFrame(() => {
      menuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]:not([disabled])')?.focus();
    });
    document.addEventListener("mousedown", onDown);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("mousedown", onDown);
    };
  }, [open]);

  const handleMenuKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const menuItems = Array.from(
      menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not([disabled])') ?? []
    );
    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
      return;
    }
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key) || menuItems.length === 0) return;
    event.preventDefault();
    const currentIndex = menuItems.indexOf(document.activeElement as HTMLButtonElement);
    const nextIndex =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? menuItems.length - 1
          : event.key === "ArrowDown"
            ? (currentIndex + 1 + menuItems.length) % menuItems.length
            : (currentIndex - 1 + menuItems.length) % menuItems.length;
    menuItems[nextIndex]?.focus();
  };

  return (
    <div className="relative inline-block text-left" ref={ref}>
      <button
        ref={triggerRef}
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        className="icon-btn inline-flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-foreground transition hover:bg-accent"
      >
        <MoreVertical size={18} />
      </button>
      {open && (
        <div
          ref={menuRef}
          role="menu"
          onKeyDown={handleMenuKeyDown}
          className="absolute right-0 z-40 mt-1 w-44 overflow-hidden rounded-xl border border-border bg-popover py-1 shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                disabled={item.disabled}
                onClick={() => { setOpen(false); item.onClick(); }}
                className={`flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                  item.destructive
                    ? "text-destructive hover:bg-destructive/10"
                    : "text-foreground hover:bg-muted"
                }`}
              >
                {Icon && <Icon size={16} />}
                {item.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
