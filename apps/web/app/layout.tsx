import "./globals.css";
import type { ReactNode } from "react";
import { AuthProvider } from "@/components/AuthProvider";
import { ServiceWorkerInit, OfflineStatusIndicator } from "@/components/OfflineStatusIndicator";
import { ThemeProvider } from "@/components/ThemeProvider";
import ThemeScript from "@/components/ThemeScript";

const siteUrl =
  process.env.NEXT_PUBLIC_APP_URL?.trim()
    ? new URL(process.env.NEXT_PUBLIC_APP_URL.trim().replace(/\/+$/, ""))
    : process.env.VERCEL_URL
      ? new URL(`https://${process.env.VERCEL_URL}`)
      : new URL("https://schoolsoftware-two.vercel.app");

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${siteUrl.origin}/#school`,
      name: "Sri Narayana High School",
      alternateName: ["SNHS", "Sri Narayana High School Ghanpur"],
      url: siteUrl.origin,
      logo: `${siteUrl.origin}/sri-narayana-high-school-logo.jpg`
    },
    {
      "@type": "WebSite",
      "@id": `${siteUrl.origin}/#website`,
      url: siteUrl.origin,
      name: "SNHS School Software",
      alternateName: "NarayanaOS",
      publisher: { "@id": `${siteUrl.origin}/#school` }
    },
    {
      "@type": "SoftwareApplication",
      name: "SNHS School Software (NarayanaOS)",
      applicationCategory: "EducationalApplication",
      operatingSystem: "Web",
      url: siteUrl.origin,
      description:
        "SNHS school management software: staff attendance, fee collection, finance, exams, salary, and parent portal for Sri Narayana High School."
    }
  ]
};

export const metadata = {
  metadataBase: siteUrl,
  title: {
    default: "SNHS School Software | NarayanaOS – Sri Narayana High School",
    template: "%s | SNHS School Software"
  },
  description:
    "SNHS School Software (NarayanaOS) – official school management software for Sri Narayana High School: staff attendance, fee collection, finance, exams, salary, and parent portal.",
  applicationName: "SNHS School Software",
  authors: [{ name: "Sri Narayana High School" }],
  creator: "Sri Narayana High School",
  publisher: "Sri Narayana High School",
  manifest: "/manifest.json",
  keywords: [
    "SNHS",
    "SNHS school software",
    "SNHS Ghanpur",
    "Sri Narayana High School",
    "srinarayanahighschool",
    "NarayanaOS",
    "school software",
    "school management software",
    "school ERP",
    "attendance software",
    "fee management software"
  ],
  alternates: {
    canonical: "/"
  },
  icons: {
    icon: "/sri-narayana-high-school-logo.jpg",
    apple: "/sri-narayana-high-school-logo.jpg"
  },
  openGraph: {
    title: "SNHS School Software | NarayanaOS – Sri Narayana High School",
    description:
      "SNHS School Software for Sri Narayana High School – attendance, fee collection, finance, exams, salary, and staff management.",
    url: "/",
    siteName: "SNHS School Software",
    locale: "en_IN",
    type: "website",
    images: [
      {
        url: "/sri-narayana-high-school-logo.jpg",
        alt: "Sri Narayana High School (SNHS) logo"
      }
    ]
  },
  twitter: {
    card: "summary",
    title: "SNHS School Software | NarayanaOS",
    description:
      "Official school management software for Sri Narayana High School – attendance, fees, finance, exams, salary."
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large"
    }
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
        <meta name="apple-mobile-web-app-title" content="NarayanaOS" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
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
