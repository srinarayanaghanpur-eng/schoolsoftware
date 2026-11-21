"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

function isEditable(target: EventTarget | null) {
  const element = target as HTMLElement | null;
  if (!element) return false;
  const tag = element.tagName.toLowerCase();
  return tag === "input" || tag === "textarea" || tag === "select" || element.isContentEditable;
}

/** Ctrl/Cmd + Shift + M opens the Communications composer from anywhere in the ERP. */
export function CommunicationShortcut() {
  const router = useRouter();

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || !event.shiftKey) return;
      if (event.key.toLowerCase() !== "m") return;
      if (isEditable(event.target)) return;
      event.preventDefault();
      router.push("/admin/communications");
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [router]);

  return null;
}
