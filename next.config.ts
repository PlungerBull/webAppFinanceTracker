import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";

/** @type {import('next').NextConfig} */
const nextConfig: NextConfig = {
  // 🚀 Performance & Clean Code
  reactStrictMode: true,
  // Note: Next.js 16/React 19 features will be added here as we scale
};

// 🛡️ Sentry Build-Time Hardening
const sentryOptions = {
  // Suppresses all logs except for errors during the build process
  silent: true,

  org: "plungerbull",
  project: "javascript-nextjs",

  // 🕵️ Hide Source Maps
  // Prevents users from seeing our unminified source code in the browser's "Sources" tab.
  // We still get them in Sentry, but the public doesn't.
  hideSourceMaps: true,

  // 📦 Bundle Optimization
  // Automatically removes Sentry's internal debug logs to keep our bundle lean.
  disableLogger: true,

  // 🏗️ App Router Optimization
  // Helps Sentry track errors across our deep feature-sliced directory structure.
  widenClientFileUpload: true,
};

export default withSentryConfig(nextConfig, sentryOptions);