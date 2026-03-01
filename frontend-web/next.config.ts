import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ['192.168.1.64', 'localhost'],
  async rewrites() {
    return [
      {
        source: '/api/auth/:path*',
        destination: 'http://192.168.1.137:8081/auth/:path*',
      },
      {
        source: '/api/map/:path*',
        destination: 'http://192.168.1.137:8000/api/:path*',
      },
      {
        source: '/api/route/:path*',
        destination: 'http://192.168.1.137:8002/api/:path*',
      },
      {
        source: '/api/congestion/:path*',
        destination: 'http://192.168.1.137:8005/api/:path*',
      },
    ];
  },
};

export default nextConfig;