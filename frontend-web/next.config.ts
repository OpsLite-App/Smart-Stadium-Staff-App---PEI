// next.config.ts
import type { NextConfig } from "next";

const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || "http://127.0.0.1:8081";
const CONGESTION_SERVICE_URL = process.env.CONGESTION_SERVICE_URL || "http://127.0.0.1:8005";
const EMERGENCY_SERVICE_URL = process.env.EMERGENCY_SERVICE_URL || "http://127.0.0.1:8006";
const MAINTENANCE_SERVICE_URL = process.env.MAINTENANCE_SERVICE_URL || "http://127.0.0.1:8007";
const QUEUEING_SERVICE_URL = process.env.QUEUEING_SERVICE_URL || "http://127.0.0.1:8003";
const ROUTING_SERVICE_URL = process.env.ROUTING_SERVICE_URL || "http://127.0.0.1:8002";
const CHAT_SERVICE_URL = process.env.CHAT_SERVICE_URL || "http://127.0.0.1:8008";
const POSITIONING_SERVICE_URL = process.env.POSITIONING_SERVICE_URL || "http://127.0.0.1:8004";
const API_GATEWAY_URL = process.env.API_GATEWAY_URL;

const destination = (gatewayPath: string, directUrl: string, directPath: string) =>
  API_GATEWAY_URL ? `${API_GATEWAY_URL}${gatewayPath}` : `${directUrl}${directPath}`;

const nextConfig: NextConfig = {
  allowedDevOrigins: ["http://192.168.1.138:3000"],
  devIndicators: false,
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
        destination: destination("/api/auth/:path*", AUTH_SERVICE_URL, "/auth/:path*"),
      },
      {
        source: "/api/congestion/alerts/:path*",
        destination: destination("/api/congestion/alerts/:path*", CONGESTION_SERVICE_URL, "/api/congestion/alerts/:path*"),
      },
      {
        source: "/api/congestion/:path*",
        destination: destination("/api/congestion/:path*", CONGESTION_SERVICE_URL, "/api/:path*"),
      },
      {
        source: "/api/emergency/sensors/alerts/:path*",
        destination: destination("/api/emergency/sensors/alerts/:path*", EMERGENCY_SERVICE_URL, "/api/emergency/sensors/alerts/:path*"),
      },
      {
        source: "/api/emergency/sensors/alert/:path*",
        destination: destination("/api/emergency/sensors/alert/:path*", EMERGENCY_SERVICE_URL, "/api/emergency/sensors/alert/:path*"),
      },
      {
        source: "/api/emergency/:path*",
        destination: destination("/api/emergency/:path*", EMERGENCY_SERVICE_URL, "/api/emergency/:path*"),
      },
      {
        source: "/api/maintenance/:path*",
        destination: destination("/api/maintenance/:path*", MAINTENANCE_SERVICE_URL, "/api/maintenance/:path*"),
      },
      {
        source: "/api/queueing/:path*",
        destination: destination("/api/queueing/:path*", QUEUEING_SERVICE_URL, "/api/queue/:path*"),
      },
      {
        source: "/api/routing/:path*",
        destination: destination("/api/routing/:path*", ROUTING_SERVICE_URL, "/api/:path*"),
      },
      {
        source: "/api/gis/:path*",
        destination: destination("/api/gis/:path*", ROUTING_SERVICE_URL, "/api/gis/:path*"),
      },
      {
        source: "/api/chat/:path*",
        destination: destination("/api/chat/:path*", CHAT_SERVICE_URL, "/:path*"),
      },
      {
        source: "/api/positioning/:path*",
        destination: destination("/api/positioning/:path*", POSITIONING_SERVICE_URL, "/:path*"),
      },
    ];
  },
};

export default nextConfig;
