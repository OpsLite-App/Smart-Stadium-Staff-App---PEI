// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      // AUTH
      // next.config.ts
      {
        source: "/api/auth/:path*",
        destination: "http://localhost:8081/auth/:path*",
      },
      {
        source: "/api/congestion/alerts/:path*",
        destination: "http://localhost:8005/api/congestion/alerts/:path*",
      },
      {
        source: "/api/congestion/:path*",
        destination: "http://localhost:8005/api/:path*",
      },
      {
        source: "/api/emergency/sensors/alerts/:path*",
        destination: "http://localhost:8006/api/emergency/sensors/alerts/:path*",
      },
      {
        source: "/api/emergency/sensors/alert/:path*",
        destination: "http://localhost:8006/api/emergency/sensors/alert/:path*",
      },
      {
        source: "/api/emergency/:path*",
        destination: "http://localhost:8006/api/emergency/:path*",
      },
      {
        source: "/api/maintenance/:path*",
        destination: "http://localhost:8007/api/maintenance/:path*",
      },
      {
        source: "/api/queueing/:path*",
        destination: "http://localhost:8003/api/queue/:path*",
      },
      {
        source: "/api/routing/:path*",
        destination: "http://localhost:8002/api/:path*",
      },
      {
        source: "/api/gis/:path*",
        destination: "http://localhost:8002/api/gis/:path*",
      },
      {
        source: "/api/map/:path*",
        destination: "http://localhost:8001/api/:path*",
      },
      {
        source: "/api/chat/:path*",
        destination: "http://localhost:8008/:path*",
      },
      {
        source: "/api/positioning/:path*",
        destination: "http://localhost:8004/:path*",
      },
    ];
  },
};

export default nextConfig;
