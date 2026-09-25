"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Renders fixed overlays (modals, dialogs, context menus) at document.body
 * level so they always paint above the fixed sidebars.
 *
 * Root cause it defends against: page containers use entrance animations
 * (.dashboard-animate / .page-enter). While an animation fill holds any
 * transform, the container becomes the containing block for position:fixed
 * descendants, trapping overlays underneath the sidebar stacking contexts.
 */
export default function OverlayPortal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  if (!mounted) return null;
  return createPortal(children, document.body);
}
