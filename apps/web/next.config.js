/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
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
            value: "public, max-age=31536000, immutable"
          }
        ]
      }
    ];
  }
};

module.exports = nextConfig;
