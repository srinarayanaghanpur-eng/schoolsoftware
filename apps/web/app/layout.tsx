import "./globals.css";
import { ServiceWorkerInit, OfflineStatusIndicator } from "@/components/OfflineStatusIndicator";

export const metadata = {
  title: "SRI NARAYANA HIGH SCHOOL",
  description: "Teacher attendance, biometric sync, salary and reports for SRI NARAYANA HIGH SCHOOL",
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" href="/sri-narayana-high-school-logo.jpg" type="image/jpeg" />
        <link rel="apple-touch-icon" href="/sri-narayana-high-school-logo.jpg" />
        <meta name="theme-color" content="#047857" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="School ERP" />
      </head>
      <body>
        <ServiceWorkerInit />
        {children}
        <OfflineStatusIndicator />
      </body>
    </html>
  );
}
