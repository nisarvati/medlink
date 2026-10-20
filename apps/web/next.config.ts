import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  async rewrites() {
    if (process.env.NODE_ENV !== "development") return [];
    return [
      { source: "/api/:path*", destination: "http://localhost:4000/api/:path*" },
      { source: "/portal-api/portal/:path*", destination: "http://localhost:4200/portal/:path*" },
    ];
  },
};

export default config;
