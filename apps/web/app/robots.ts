import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/teacher/", "/admin/"]
    },
    sitemap: "https://snhssoftware.vercel.app/sitemap.xml"
  };
}
