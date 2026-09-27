import type { MetadataRoute } from "next";

const siteUrl =
  process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/+$/, "") ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://schoolsoftware-two.vercel.app");

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/login"],
        disallow: ["/api/", "/admin/", "/teacher/", "/portal/", "/accountant/", "/principal/", "/parent/", "/receipts/", "/vouchers/", "/student-qr"]
      }
    ],
    sitemap: `${siteUrl}/sitemap.xml`
  };
}
