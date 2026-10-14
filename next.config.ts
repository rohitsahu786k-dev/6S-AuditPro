import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/docs/:path*",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'self'; object-src 'self'" }
        ]
      },
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'self'; object-src 'self'; base-uri 'self'" }
        ]
      }
    ];
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "6mb"
    }
  }
};

export default nextConfig;