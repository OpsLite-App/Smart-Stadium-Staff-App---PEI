// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["http://192.168.1.138:3000"],
  turbopack: {
    // The repo root also has a lockfile. Keep Turbopack scoped to this Next app
    // so CSS tooling resolves dependencies from frontend-web/node_modules.
    root: process.cwd(),
  },
  async rewrites() {
    return [
      // AUTH
      // next.config.ts
      {
        source: "/api/auth/:path*",
        destination: "http://127.0.0.1:8081/auth/:path*",
      },
      {
        source: "/api/congestion/alerts/:path*",
        destination: "http://127.0.0.1:8005/api/congestion/alerts/:path*",
      },
      {
        source: "/api/congestion/:path*",
        destination: "http://127.0.0.1:8005/api/:path*",
      },
      {
        source: "/api/emergency/sensors/alerts/:path*",
        destination: "http://127.0.0.1:8006/api/emergency/sensors/alerts/:path*",
      },
      {
        source: "/api/emergency/sensors/alert/:path*",
        destination: "http://127.0.0.1:8006/api/emergency/sensors/alert/:path*",
      },
      {
        source: "/api/emergency/:path*",
        destination: "http://127.0.0.1:8006/api/emergency/:path*",
      },
      {
        source: "/api/maintenance/:path*",
        destination: "http://127.0.0.1:8007/api/maintenance/:path*",
      },
      {
        source: "/api/queueing/:path*",
        destination: "http://127.0.0.1:8003/api/queue/:path*",
      },
      {
        source: "/api/routing/:path*",
        destination: "http://127.0.0.1:8002/api/:path*",
      },
      {
        source: "/api/gis/:path*",
        destination: "http://127.0.0.1:8002/api/gis/:path*",
      },
      {
        source: "/api/chat/:path*",
        destination: "http://127.0.0.1:8008/:path*",
      },
      {
        source: "/api/positioning/:path*",
        destination: "http://127.0.0.1:8004/:path*",
      },
    ];
  },
};

export default nextConfig;
