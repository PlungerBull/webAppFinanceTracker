import * as Sentry from "@sentry/nextjs";
import { beforeSend, beforeBreadcrumb } from "@/lib/sentry/scrubber";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // 🛡️ CTO PRIVACY SHIELD — Allowlist-based PII scrubber
  beforeSend,
  beforeBreadcrumb,

  tracesSampleRate: 1.0, // Development; we will lower this for Production.
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
});
