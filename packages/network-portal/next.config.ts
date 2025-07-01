import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Image optimization
  images: {
    formats: ['image/webp', 'image/avif'],
  },

  // Performance optimizations
  poweredByHeader: false,
  compress: true,

  // Allow dev origins for cross-origin requests
  allowedDevOrigins: ['10.0.0.185:3003', 'localhost:3003'],

  // Environment variables
  env: {
    API_BASE_URL: process.env.API_BASE_URL || 'http://localhost:3002',
    FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:3003',
  },

  // API rewrites to proxy to backend server
  // NOTE: Commented out because we're using Next.js API routes for proxying instead
  // async rewrites() {
  //   return [
  //     {
  //       source: '/api/:path*',
  //       destination: `${process.env.API_BASE_URL || 'http://localhost:3002'}/api/:path*`,
  //     },
  //   ];
  // },

  // Headers for security
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
