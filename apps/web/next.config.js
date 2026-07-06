/** @type {import('next').NextConfig} */
const nextConfig = {
  output: process.env.STANDALONE ? "standalone" : undefined,
  reactStrictMode: true,
  transpilePackages: ["@sri-narayana/shared"],
  experimental: {
    optimizePackageImports: ["lucide-react", "recharts"],
    serverComponentsExternalPackages: ["firebase-admin"]
  },
  compress: true,
  swcMinify: true,
  productionBrowserSourceMaps: false,
  images: {
    unoptimized: true,
    minimumCacheTTL: 31536000
  },
  onDemandEntries: {
    maxInactiveAge: 25 * 1000,
    pagesBufferLength: 5
  },
  headers: async () => {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=0, must-revalidate"
          }
        ]
      },
      {
        source: "/api/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "no-store, no-cache, must-revalidate, proxy-revalidate"
          },
          {
            key: "Pragma",
            value: "no-cache"
          }
        ]
      },
      {
        source: "/:path*.:ext(jpg|png|svg|js|css|woff2|ico|webp)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable"
          }
        ]
      }
    ];
  }
};

module.exports = nextConfig;
