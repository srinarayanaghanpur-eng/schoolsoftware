"use client";

import { Eye, EyeOff } from "lucide-react";
import { useState, type InputHTMLAttributes } from "react";

type PasswordInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type">;

export function PasswordInput({ className = "field", disabled, readOnly, style, ...props }: PasswordInputProps) {
  const [visible, setVisible] = useState(false);
  const isToggleDisabled = Boolean(disabled);

  return (
    <div className="relative">
      <input
        {...props}
        className={className}
        disabled={disabled}
        readOnly={readOnly}
        style={{ paddingRight: "2.75rem", ...style }}
        type={visible ? "text" : "password"}
      />
      <button
        type="button"
        aria-label={visible ? "Hide password" : "Show password"}
        title={visible ? "Hide password" : "Show password"}
        className="absolute right-3 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-lg text-muted-foreground transition hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50"
        disabled={isToggleDisabled}
        onClick={() => setVisible((value) => !value)}
      >
        {visible ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  );
}
