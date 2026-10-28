"use client";

import clsx from "clsx";
import { CornerDownLeft, Keyboard, Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";

export type ShortcutItem = {
  href: string;
  label: string;
  group: string;
  keywords?: string;
};

type DialogKind = "palette" | "help" | null;

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function trapTab(event: KeyboardEvent, container: HTMLElement | null) {
  if (event.key !== "Tab" || !container) return;
  const focusable = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (element) => element.offsetParent !== null
  );
  if (focusable.length === 0) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

export function KeyboardShortcuts({ items }: { items: ShortcutItem[] }) {
  const router = useRouter();
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const filteredItems = useMemo(() => {
    const normalizedQuery = normalize(query);
    if (!normalizedQuery) return items;
    const terms = normalizedQuery.split(" ").filter(Boolean);
    return items.filter((item) => {
      const haystack = normalize(`${item.label} ${item.group} ${item.keywords ?? ""} ${item.href}`);
      return terms.every((term) => haystack.includes(term));
    });
  }, [items, query]);

  const openDialog = (kind: Exclude<DialogKind, null>) => {
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : triggerRef.current;
    setQuery("");
    setActiveIndex(0);
    setDialog(kind);
  };

  const closeDialog = (restoreFocus = true) => {
    setDialog(null);
    if (!restoreFocus) return;
    const target = previousFocusRef.current ?? triggerRef.current;
    window.setTimeout(() => target?.focus(), 0);
  };

  const goTo = (item: ShortcutItem) => {
    closeDialog(false);
    router.push(item.href);
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const modifier = event.metaKey || event.ctrlKey;
      if (modifier && !event.altKey && event.key.toLowerCase() === "k") {
        event.preventDefault();
        if (dialog) closeDialog();
        else openDialog("palette");
        return;
      }

      if (event.key === "Escape" && dialog) {
        event.preventDefault();
        closeDialog();
        return;
      }

      if (dialog) return;
      if (isEditableTarget(event.target)) return;

      if (event.altKey && !event.metaKey && !event.ctrlKey && /^[1-9]$/.test(event.key)) {
        const item = items[Number(event.key) - 1];
        if (item) {
          event.preventDefault();
          router.push(item.href);
        }
        return;
      }

      if (!event.altKey && !event.metaKey && !event.ctrlKey && event.key === "?") {
        event.preventDefault();
        openDialog("help");
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [dialog, items, router]);

  useEffect(() => {
    if (!dialog) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const frame = window.requestAnimationFrame(() => {
      if (dialog === "palette") inputRef.current?.focus();
      else dialogRef.current?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)?.focus();
    });
    const onKeyDown = (event: KeyboardEvent) => trapTab(event, dialogRef.current);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [dialog]);

  useEffect(() => {
    if (activeIndex < filteredItems.length) return;
    setActiveIndex(Math.max(0, filteredItems.length - 1));
  }, [activeIndex, filteredItems.length]);

  useEffect(() => {
    if (!dialog) return;
    const active = listRef.current?.querySelector<HTMLElement>(`[data-shortcut-index="${activeIndex}"]`);
    active?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, dialog]);

  const handleSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => (filteredItems.length ? (index + 1) % filteredItems.length : 0));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => (filteredItems.length ? (index - 1 + filteredItems.length) % filteredItems.length : 0));
    } else if (event.key === "Enter" && filteredItems[activeIndex]) {
      event.preventDefault();
      goTo(filteredItems[activeIndex]);
    }
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        data-testid="keyboard-shortcuts-trigger"
        onClick={() => openDialog("palette")}
        aria-haspopup="dialog"
        aria-label="Open quick navigation (Ctrl+K)"
        title="Quick navigation (Ctrl+K)"
        className="hidden h-10 w-10 shrink-0 place-items-center rounded-lg bg-accent text-accent-foreground transition hover:bg-muted sm:grid md:h-11 md:w-11"
      >
        <Keyboard size={19} />
      </button>

      {dialog && (
        <div
          className="fixed inset-0 z-[200] flex items-start justify-center overflow-y-auto bg-slate-950/55 p-3 pt-[8vh] backdrop-blur-sm sm:p-6 sm:pt-[12vh]"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeDialog();
          }}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="keyboard-dialog-title"
            className="w-full max-w-2xl overflow-hidden rounded-2xl border border-border bg-popover text-popover-foreground shadow-2xl"
          >
            <h2 id="keyboard-dialog-title" className="sr-only">
              {dialog === "palette" ? "Quick navigation" : "Keyboard shortcuts"}
            </h2>

            {dialog === "palette" ? (
              <>
                <div className="flex items-center gap-3 border-b border-border px-4 py-3">
                  <Search size={19} className="shrink-0 text-muted-foreground" />
                  <input
                    ref={inputRef}
                    type="search"
                    value={query}
                    onChange={(event) => {
                      setQuery(event.target.value);
                      setActiveIndex(0);
                    }}
                    onKeyDown={handleSearchKeyDown}
                    placeholder="Search pages and modules…"
                    aria-label="Search pages and modules"
                    className="h-10 min-w-0 flex-1 bg-transparent text-base font-semibold text-foreground outline-none placeholder:text-muted-foreground"
                  />
                  <button
                    type="button"
                    onClick={() => closeDialog()}
                    aria-label="Close quick navigation"
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground"
                  >
                    <X size={18} />
                  </button>
                </div>

                <div ref={listRef} className="max-h-[58vh] overflow-y-auto p-2">
                  {filteredItems.length === 0 ? (
                    <p className="px-4 py-10 text-center text-sm font-semibold text-muted-foreground">
                      No pages match “{query}”.
                    </p>
                  ) : (
                    filteredItems.map((item, index) => {
                      const showGroup = index === 0 || filteredItems[index - 1].group !== item.group;
                      const active = index === activeIndex;
                      return (
                        <Fragment key={`${item.href}-${item.label}`}>
                          {showGroup && (
                            <p className="px-3 pb-1 pt-3 text-[10px] font-extrabold uppercase tracking-[0.14em] text-muted-foreground">
                              {item.group}
                            </p>
                          )}
                          <button
                            type="button"
                            data-shortcut-index={index}
                            aria-current={active ? "true" : undefined}
                            onMouseEnter={() => setActiveIndex(index)}
                            onClick={() => goTo(item)}
                            className={clsx(
                              "flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left transition",
                              active ? "bg-accent text-accent-foreground" : "text-foreground hover:bg-muted"
                            )}
                          >
                            <span className="min-w-0">
                              <span className="block truncate text-sm font-bold">{item.label}</span>
                              <span className="block truncate text-xs font-medium text-muted-foreground">{item.href}</span>
                            </span>
                            {active && <CornerDownLeft size={16} className="shrink-0" />}
                          </button>
                        </Fragment>
                      );
                    })
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border px-4 py-2.5 text-[11px] font-semibold text-muted-foreground">
                  <span><kbd className="shortcut-key">↑</kbd><kbd className="shortcut-key">↓</kbd> move</span>
                  <span><kbd className="shortcut-key">Enter</kbd> open</span>
                  <span><kbd className="shortcut-key">Esc</kbd> close</span>
                  <span className="ml-auto">Ctrl/Cmd + K</span>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
                  <div>
                    <h2 className="text-lg font-extrabold tracking-tight text-foreground">Keyboard shortcuts</h2>
                    <p className="mt-0.5 text-sm font-medium text-muted-foreground">
                      Navigate the ERP without leaving the keyboard.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => closeDialog()}
                    aria-label="Close keyboard shortcuts"
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground"
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="grid gap-5 p-5 sm:grid-cols-2">
                  <section>
                    <h3 className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-muted-foreground">Navigation</h3>
                    <dl className="mt-2 space-y-2.5">
                      {[
                        ["Ctrl/Cmd + K", "Quick navigation"],
                        ["Alt + 1–9", "Open pinned page"],
                        ["?", "Show this help"],
                        ["Esc", "Close dialog or menu"]
                      ].map(([keys, action]) => (
                        <div key={keys} className="flex items-start justify-between gap-3 text-sm">
                          <dt className="font-semibold text-foreground">{action}</dt>
                          <dd className="shrink-0"><kbd className="shortcut-key">{keys}</kbd></dd>
                        </div>
                      ))}
                    </dl>
                  </section>

                  <section>
                    <h3 className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-muted-foreground">Forms and lists</h3>
                    <dl className="mt-2 space-y-2.5">
                      {[
                        ["Tab", "Next field or control"],
                        ["Shift + Tab", "Previous field or control"],
                        ["Enter", "Submit or open selected item"],
                        ["Space", "Toggle the focused control"]
                      ].map(([keys, action]) => (
                        <div key={keys} className="flex items-start justify-between gap-3 text-sm">
                          <dt className="font-semibold text-foreground">{action}</dt>
                          <dd className="shrink-0"><kbd className="shortcut-key">{keys}</kbd></dd>
                        </div>
                      ))}
                    </dl>
                  </section>
                </div>

                <div className="border-t border-border px-5 py-3 text-xs font-medium text-muted-foreground">
                  Alt+number and ? are disabled while typing in a field.
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
