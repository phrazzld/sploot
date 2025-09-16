import type { NextConfig } from "next";
import withPWA from "@ducanh2912/next-pwa";
import { mockServicesEnabled } from "./lib/env";

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_ENABLE_MOCK_SERVICES:
      process.env.NEXT_PUBLIC_ENABLE_MOCK_SERVICES ?? (mockServicesEnabled ? "true" : "false"),
  },
};

export default withPWA({
  dest: "public",
  register: true,
  reloadOnOnline: true,
  disable: process.env.NODE_ENV === "development",
  workboxOptions: {
    disableDevLogs: true,
    importScripts: ['/sw-custom.js', '/sw-cache-strategies.js'],
    skipWaiting: true,
    clientsClaim: true,
    runtimeCaching: [
      // App Shell - Critical pages cached with StaleWhileRevalidate
      {
        urlPattern: /^\/$/,
        handler: "StaleWhileRevalidate",
        options: {
          cacheName: "app-shell",
          expiration: {
            maxEntries: 10,
            maxAgeSeconds: 7 * 24 * 60 * 60, // 7 days
          },
        },
      },
      {
        urlPattern: /^\/app(?:\/.*)?$/,
        handler: "NetworkFirst",
        options: {
          cacheName: "app-pages",
          networkTimeoutSeconds: 3,
          expiration: {
            maxEntries: 20,
            maxAgeSeconds: 24 * 60 * 60, // 24 hours
          },
        },
      },
      // Static assets - Aggressive caching
      {
        urlPattern: /\/_next\/static\/.*/i,
        handler: "CacheFirst",
        options: {
          cacheName: "next-static",
          expiration: {
            maxEntries: 60,
            maxAgeSeconds: 365 * 24 * 60 * 60, // 1 year
          },
        },
      },
      // Fonts - Permanent cache
      {
        urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
        handler: "CacheFirst",
        options: {
          cacheName: "google-fonts",
          expiration: {
            maxEntries: 10,
            maxAgeSeconds: 365 * 24 * 60 * 60, // 365 days
          },
        },
      },
      {
        urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
        handler: "CacheFirst",
        options: {
          cacheName: "gstatic-fonts",
          expiration: {
            maxEntries: 10,
            maxAgeSeconds: 365 * 24 * 60 * 60, // 365 days
          },
        },
      },
      // API endpoints - Smart caching based on endpoint
      {
        urlPattern: /^\/api\/assets(?:\/.*)?$/,
        handler: "NetworkFirst",
        options: {
          cacheName: "api-assets",
          networkTimeoutSeconds: 5,
          expiration: {
            maxEntries: 50,
            maxAgeSeconds: 5 * 60, // 5 minutes
          },
          cacheableResponse: {
            statuses: [0, 200],
          },
        },
      },
      {
        urlPattern: /^\/api\/search(?:\/.*)?$/,
        handler: "NetworkFirst",
        options: {
          cacheName: "api-search",
          networkTimeoutSeconds: 3,
          expiration: {
            maxEntries: 20,
            maxAgeSeconds: 10 * 60, // 10 minutes
          },
          cacheableResponse: {
            statuses: [0, 200],
          },
        },
      },
      {
        urlPattern: /^\/api\/health$/,
        handler: "NetworkOnly",
        options: {
          cacheName: "api-health",
        },
      },
      // User uploaded images - Intelligent caching with Vercel Blob URLs
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
          cacheableResponse: {
            statuses: [0, 200],
          },
        },
      },
      // Thumbnails - Smaller cache with shorter expiry
      {
        urlPattern: /^https:\/\/.*\.public\.blob\.vercel-storage\.com\/.*[\?&]thumb=true.*/i,
        handler: "CacheFirst",
        options: {
          cacheName: "thumbnails",
          expiration: {
            maxEntries: 200,
            maxAgeSeconds: 7 * 24 * 60 * 60, // 7 days
            purgeOnQuotaError: true,
          },
        },
      },
      // General images
      {
        urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|avif)$/i,
        handler: "CacheFirst",
        options: {
          cacheName: "image-cache",
          expiration: {
            maxEntries: 100,
            maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
            purgeOnQuotaError: true,
          },
        },
      },
      // JSON data
      {
        urlPattern: /\.json$/i,
        handler: "StaleWhileRevalidate",
        options: {
          cacheName: "json-cache",
          expiration: {
            maxEntries: 30,
            maxAgeSeconds: 24 * 60 * 60, // 24 hours
          },
        },
      },
      // CSS and JS files
      {
        urlPattern: /\.(?:js|css)$/i,
        handler: "StaleWhileRevalidate",
        options: {
          cacheName: "assets-cache",
          expiration: {
            maxEntries: 50,
            maxAgeSeconds: 7 * 24 * 60 * 60, // 7 days
          },
        },
      },
    ],
  },
})(nextConfig);
