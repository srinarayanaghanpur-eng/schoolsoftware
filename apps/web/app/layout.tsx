import "./globals.css";
import type { ReactNode } from "react";
import { ServiceWorkerInit, OfflineStatusIndicator } from "@/components/OfflineStatusIndicator";
import { ThemeProvider } from "@/components/ThemeProvider";

export const metadata = {
  title: "Sri Narayana High School – School ERP",
  description: "School ERP – attendance, fee, finance, exams, and staff management for Sri Narayana High School",
  manifest: "/manifest.json",
  icons: {
    icon: "/sri-narayana-high-school-logo.jpg",
    apple: "/sri-narayana-high-school-logo.jpg"
  }
};

export const viewport = {
  themeColor: "#047857",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" href="/sri-narayana-high-school-logo.jpg" type="image/jpeg" />
        <link rel="apple-touch-icon" href="/sri-narayana-high-school-logo.jpg" />
        <meta name="theme-color" content="#047857" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="SNHS ERP" />
        <script dangerouslySetInnerHTML={{
          __html: `(function(){try{var e=localStorage.getItem("erp-theme"),r=window.matchMedia("(prefers-color-scheme:dark)").matches;document.documentElement.classList.toggle("dark",e==="dark"||(!e&&r))}catch(e){}})()`
        }} />
      </head>
      <body>
        <ServiceWorkerInit />
        <ThemeProvider>{children}</ThemeProvider>
        <OfflineStatusIndicator />
      </body>
    </html>
  );
}
