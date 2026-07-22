import "./globals.css";
import type { ReactNode } from "react";
import { AuthProvider } from "@/components/AuthProvider";
import { ServiceWorkerInit, OfflineStatusIndicator } from "@/components/OfflineStatusIndicator";
import { ThemeProvider } from "@/components/ThemeProvider";
import ThemeScript from "@/components/ThemeScript";

export const metadata = {
  title: "Sri Narayana High School – School Management Software",
  description: "Sri Narayana High School software – school management ERP for attendance, fee, finance, exams, staff management. The official integrated school management system for Sri Narayana High School.",
  manifest: "/manifest.json",
  keywords: ["Sri Narayana High School", "srinarayanahighschool", "school software", "school management system", "ERP", "attendance software"],
  icons: {
    icon: "/sri-narayana-high-school-logo.jpg",
    apple: "/sri-narayana-high-school-logo.jpg"
  },
  openGraph: {
    title: "Sri Narayana High School – School Management Software",
    description: "Official school management ERP for Sri Narayana High School – attendance, fee, finance, exams, and staff management.",
    siteName: "Sri Narayana High School ERP",
    type: "website"
  },
  robots: {
    index: true,
    follow: true
  }
};

export const viewport = {
  themeColor: "#047857",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover"
};

const MOBILE_UI_BOOTSTRAP = `(function(){try{var n="erp_mobile_ui",m=window.matchMedia("(max-width: 767px)").matches,c=document.cookie.split("; ").some(function(v){return v.indexOf(n+"=")===0});if(m&&!c){document.cookie=n+"=1; Path=/; SameSite=Lax";window.stop();window.location.replace(window.location.href)}}catch(e){}})()`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: MOBILE_UI_BOOTSTRAP }} />
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" href="/sri-narayana-high-school-logo.jpg" type="image/jpeg" />
        <link rel="apple-touch-icon" href="/sri-narayana-high-school-logo.jpg" />
        <meta name="theme-color" content="#047857" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="SNHS ERP" />
        <ThemeScript />
      </head>
      <body>
        <ServiceWorkerInit />
        <ThemeProvider>
          <AuthProvider>{children}</AuthProvider>
        </ThemeProvider>
        <OfflineStatusIndicator />
      </body>
    </html>
  );
}
