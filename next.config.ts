import type { NextConfig } from "next";
import withPWA from "@ducanh2912/next-pwa";
import { mockServicesEnabled } from "./lib/env";

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_ENABLE_MOCK_SERVICES:
      process.env.NEXT_PUBLIC_ENABLE_MOCK_SERVICES ?? (mockServicesEnabled ? "true" : "false"),
  },
  eslint: {
    // Allow production builds to succeed even if there are ESLint errors
    ignoreDuringBuilds: true,
  },
  // Compiler optimizations for production
  compiler: {
    // Remove all console statements in production builds
    // This provides zero runtime overhead - console calls are completely stripped
    removeConsole: process.env.NODE_ENV === "production" ? {
      // Keep console.error and console.warn for production debugging
      exclude: ["error", "warn"],
    } : false,
  },
  // Configure server actions and API routes
  experimental: {
    serverActions: {
      // Increase body size limit to 50MB for large image uploads
      // This applies globally to all server actions and API routes
      // Note: App Router doesn't support per-route body size limits
      bodySizeLimit: '50mb',
    },
  },
};

export default withPWA({
  dest: "public",
  register: true,
  reloadOnOnline: true,
  disable: process.env.NODE_ENV === "development",
  workboxOptions: {
    disableDevLogs: true,
    importScripts: ['/sw-custom.js'],
    skipWaiting: true,
    clientsClaim: true,
    runtimeCaching: [
      // Custom: Vercel Blob Storage images (our app-specific requirement)
      {
        urlPattern: /^https:\/\/.*\.public\.blob\.vercel-storage\.com\/.*/i,
        handler: "CacheFirst",
        options: {
          cacheName: "user-images",
          expiration: {
            maxEntries: 500,
            maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
            purgeOnQuotaError: true,
          },
        },
      },
      // Custom: Search API with smart caching
      {
        urlPattern: /^\/api\/search(?:\/.*)?$/,
        handler: "StaleWhileRevalidate",
        options: {
          cacheName: "api-search",
          expiration: {
            maxEntries: 20,
            maxAgeSeconds: 10 * 60, // 10 minutes
          },
        },
      },
    ],
  },
})(nextConfig);