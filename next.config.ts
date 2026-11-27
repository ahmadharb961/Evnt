import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  serverExternalPackages: ["sharp", "@prisma/client"],
  experimental: {
    serverActions: { bodySizeLimit: "40mb" },
    // Hostinger caps threads per account: build with one worker.
    cpus: 1,
    workerThreads: false,
  },
  images: {
    remotePatterns: [{ protocol: "https", hostname: "images.unsplash.com" }],
    // Resized photos are cached for 30 days (uploads get new addresses, so changes still show).
    minimumCacheTTL: 2592000,
    formats: ["image/webp"],
  },
  // Old links to features that were removed go somewhere sensible instead of "page not found".
  async redirects() {
    return [
      { source: "/plus", destination: "/", permanent: true },
      { source: "/farah-approved", destination: "/", permanent: true },
      { source: "/birthdays/plan/:id", destination: "/c/birthdays-parties", permanent: true },
      { source: "/merchant/leads", destination: "/merchant", permanent: true },
      { source: "/merchant/certification", destination: "/merchant", permanent: true },
      { source: "/admin/plus", destination: "/admin", permanent: true },
      { source: "/admin/farah/:path*", destination: "/admin", permanent: true },
      { source: "/admin/birthdays", destination: "/admin", permanent: true },
    ];
  },
  async headers() {
    return [
      { source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache" }] },
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Permissions-Policy", value: "camera=(self), geolocation=(self), microphone=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
