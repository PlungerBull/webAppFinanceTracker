import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  
  // 🛡️ CTO PRIVACY SHIELD
  beforeSend(event) {
    // 1. Scrub Request Data (where transaction descriptions live)
    if (event.request?.data) {
      delete event.request.data;
    }

    // 2. Scrub Breadcrumbs (removes typed notes/descriptions from the "trail")
    event.breadcrumbs = event.breadcrumbs?.map((breadcrumb) => {
      if (breadcrumb.category === "ui.input" || breadcrumb.category === "console") {
        return { ...breadcrumb, message: "[SCRUBBED_FINANCIAL_DATA]" };
      }
      return breadcrumb;
    });

    return event;
  },

  tracesSampleRate: 1.0, // Development; we will lower this for Production.
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
});