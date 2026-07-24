"use client";

import Script from "next/script";

const THEME_SCRIPT = `(function(){try{var e=localStorage.getItem("erp-theme"),r=window.matchMedia("(prefers-color-scheme:dark)").matches;document.documentElement.classList.toggle("dark",e==="dark"||(!e&&r))}catch(e){}})()`;

export default function ThemeScript() {
  return (
    <Script
      id="theme-init"
      strategy="beforeInteractive"
      dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }}
    />
  );
}
