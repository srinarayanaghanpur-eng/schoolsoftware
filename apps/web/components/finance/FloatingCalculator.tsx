"use client";

import { Calculator, Copy, GripHorizontal, Minus, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

const STORAGE_POS = "floating-calc-pos";
const STORAGE_STATE = "floating-calc-state";

type CalcAction = "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "." | "+" | "-" | "×" | "÷" | "%" | "C" | "Backspace" | "=";

export default function FloatingCalculator({ role }: { role?: string }) {
  const isFinanceRole = role && ["super_admin", "admin", "accountant"].includes(role);
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [display, setDisplay] = useState("0");
  const [expression, setExpression] = useState("");
  const [pos, setPos] = useState({ x: typeof window !== "undefined" ? window.innerWidth - 380 : 1020, y: 120 });
  const [dragging, setDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [copied, setCopied] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia("(max-width: 767px)");
    setIsMobile(mql.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_POS);
      if (saved) setPos(JSON.parse(saved));
    } catch { /* ignore */ }
    try {
      const saved = localStorage.getItem(STORAGE_STATE);
      if (saved) {
        const s = JSON.parse(saved);
        if (typeof s.open === "boolean") setOpen(s.open);
        if (typeof s.minimized === "boolean") setMinimized(s.minimized);
        if (typeof s.display === "string") setDisplay(s.display);
        if (typeof s.expression === "string") setExpression(s.expression);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_POS, JSON.stringify(pos));
    } catch { /* ignore */ }
  }, [pos]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_STATE, JSON.stringify({ open, minimized, display, expression }));
    } catch { /* ignore */ }
  }, [open, minimized, display, expression]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (isMobile) return;
    setDragging(true);
    setDragOffset({ x: e.clientX - pos.x, y: e.clientY - pos.y });
  }, [pos, isMobile]);

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: MouseEvent) => {
      let nx = e.clientX - dragOffset.x;
      let ny = e.clientY - dragOffset.y;
      const mw = window.innerWidth, mh = window.innerHeight;
      const pw = panelRef.current?.offsetWidth ?? 340;
      const ph = panelRef.current?.offsetHeight ?? 460;
      nx = Math.max(0, Math.min(nx, mw - pw));
      ny = Math.max(0, Math.min(ny, mh - ph));
      setPos({ x: nx, y: ny });
    };
    const onUp = () => setDragging(false);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, [dragging, dragOffset]);

  const handleAction = (action: CalcAction) => {
    if (action === "C") { setDisplay("0"); setExpression(""); return; }
    if (action === "Backspace") {
      setDisplay((d) => d.length > 1 ? d.slice(0, -1) : "0");
      return;
    }
    if (action === "=") {
      try {
        const evalExpr = expression + display;
        const result = Function('"use strict"; return (' + evalExpr.replace(/×/g, "*").replace(/÷/g, "/") + ')')();
        setDisplay(String(result));
        setExpression("");
      } catch { setDisplay("Error"); }
      return;
    }
    if (["+", "-", "×", "÷", "%"].includes(action)) {
      const current = expression + display;
      setExpression(current + ` ${action} `);
      setDisplay("0");
      return;
    }
    if (action === ".") {
      if (display.includes(".")) return;
      setDisplay((d) => d + ".");
      return;
    }
    setDisplay((d) => (d === "0" ? action : d + action));
  };

  const handleQuick = (label: string, value: string) => {
    setDisplay(value);
    setExpression("");
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(display);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  };

  const btns: CalcAction[] = ["C", "Backspace", "%", "÷", "7", "8", "9", "×", "4", "5", "6", "-", "1", "2", "3", "+", "0", ".", "="];

  if (!isFinanceRole) return null;

  return (
    <>
      {/* Floating toggle button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-40 grid h-12 w-12 place-items-center rounded-2xl bg-[#2563eb] text-white shadow-lg hover:bg-[#1d4ed8] transition-all"
          title="Calculator"
        >
          <Calculator size={22} />
        </button>
      )}

      {/* Calculator panel */}
      {open && (
        <div
          ref={panelRef}
          style={isMobile ? undefined : { left: pos.x, top: pos.y }}
          className={`z-40 ${isMobile ? "fixed inset-x-0 bottom-0" : "fixed"}`}
        >
          {isMobile ? (
            /* Mobile bottom sheet */
            <div className="rounded-t-3xl border-t border-[#e2e8f0] bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-[#f1f5f9] px-5 py-3">
                <div className="flex items-center gap-2">
                  <Calculator size={18} className="text-[#2563eb]" />
                  <span className="text-sm font-extrabold text-[#1e293b]">Finance Calculator</span>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => setOpen(false)} className="rounded-lg p-2 hover:bg-[#f1f5f9]"><X size={18} /></button>
                </div>
              </div>
              <CalculatorBody
                display={display}
                expression={expression}
                copied={copied}
                onAction={handleAction}
                onCopy={handleCopy}
                onQuick={handleQuick}
                isMobile
              />
            </div>
          ) : (
            /* Desktop draggable card */
            <div
              className={`w-[340px] rounded-2xl border border-[#e2e8f0] bg-white shadow-2xl ${minimized ? "" : ""}`}
            >
              {/* Header */}
              <div className="flex items-center justify-between rounded-t-2xl bg-[#2563eb] px-4 py-2.5 text-white cursor-grab active:cursor-grabbing select-none" onMouseDown={handleMouseDown}>
                <div className="flex items-center gap-2">
                  <GripHorizontal size={14} />
                  <span className="text-xs font-extrabold">Finance Calculator</span>
                </div>
                <div className="flex items-center gap-0.5">
                  <button onClick={() => setMinimized(!minimized)} className="rounded-lg p-1 hover:bg-white/20"><Minus size={14} /></button>
                  <button onClick={() => setOpen(false)} className="rounded-lg p-1 hover:bg-white/20"><X size={14} /></button>
                </div>
              </div>

              {!minimized && (
                <CalculatorBody
                  display={display}
                  expression={expression}
                  copied={copied}
                  onAction={handleAction}
                  onCopy={handleCopy}
                  onQuick={handleQuick}
                  isMobile={false}
                />
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
}

function CalculatorBody({
  display, expression, copied, onAction, onCopy, onQuick, isMobile
}: {
  display: string;
  expression: string;
  copied: boolean;
  onAction: (a: CalcAction) => void;
  onCopy: () => void;
  onQuick: (label: string, value: string) => void;
  isMobile: boolean;
}) {
  const tw = isMobile ? "text-xl" : "text-sm";
  const btnSize = isMobile ? "h-14 text-lg" : "h-11 text-sm";
  const quickBtns = [
    { label: "Add GST 18%", fn: () => {
      const v = parseFloat(display) || 0;
      onQuick("GST", String(v * 1.18));
    }},
    { label: "Discount 10%", fn: () => {
      const v = parseFloat(display) || 0;
      onQuick("Discount", String(v * 0.9));
    }},
    { label: "Split /2", fn: () => {
      const v = parseFloat(display) || 0;
      onQuick("Split", String(v / 2));
    }},
    { label: "Due = Total - Paid", fn: () => {
      onQuick("Due", "0");
    }},
  ];

  const btns: CalcAction[] = ["C", "Backspace", "%", "÷", "7", "8", "9", "×", "4", "5", "6", "-", "1", "2", "3", "+", "0", ".", "="];

  return (
    <div className={`p-4 ${isMobile ? "pb-8" : ""}`}>
      {/* Quick shortcuts */}
      <div className="mb-3 flex flex-wrap gap-1.5">
        {quickBtns.map((q) => (
          <button key={q.label} onClick={q.fn} className="rounded-lg bg-[#eff6ff] px-2.5 py-1.5 text-[11px] font-bold text-[#2563eb] hover:bg-[#dbeafe] transition-colors">
            {q.label}
          </button>
        ))}
      </div>

      {/* Display */}
      <div className="mb-3 rounded-xl bg-[#f8fafc] p-3 text-right">
        {expression && <div className="text-[11px] font-medium text-[#94a3b8] truncate">{expression}</div>}
        <div className="flex items-center justify-between">
          <button onClick={onCopy} className="rounded p-1 hover:bg-[#e2e8f0] transition-colors" title="Copy result">
            {copied ? <span className="text-[11px] font-bold text-[#16a34a]">Copied!</span> : <Copy size={14} className="text-[#94a3b8]" />}
          </button>
          <span className={`font-extrabold text-[#1e293b] ${isMobile ? "text-3xl" : "text-2xl"} truncate ml-2`}>
            {display}
          </span>
        </div>
      </div>

      {/* Buttons grid */}
      <div className="grid grid-cols-4 gap-2">
        {btns.map((b) => {
          const isOp = ["+", "-", "×", "÷", "%"].includes(b);
          const isEq = b === "=";
          const isClear = b === "C";
          const isBack = b === "Backspace";
          const isNum = !isOp && !isEq && !isClear && !isBack;
          return (
            <button
              key={b}
              onClick={() => onAction(b)}
              className={`rounded-xl font-extrabold transition-all active:scale-95 ${btnSize} ${
                isEq ? "bg-[#2563eb] text-white hover:bg-[#1d4ed8]" :
                isClear ? "bg-[#fef2f2] text-[#dc2626] hover:bg-[#fde8e8]" :
                isOp ? "bg-[#eff6ff] text-[#2563eb] hover:bg-[#dbeafe]" :
                isBack ? "bg-[#f1f5f9] text-[#64748b] hover:bg-[#e2e8f0]" :
                "bg-[#f8fafc] text-[#1e293b] hover:bg-[#f1f5f9]"
              }`}
            >
              {b === "Backspace" ? "⌫" : b}
            </button>
          );
        })}
      </div>

      {/* Copy toast */}
      {copied && (
        <div className="mt-2 text-center text-[11px] font-bold text-[#16a34a]">Result copied to clipboard</div>
      )}
    </div>
  );
}
