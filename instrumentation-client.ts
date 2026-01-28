// Client instrumentation hooks.
// Sentry.init() lives in sentry.client.config.ts (single source of truth).

import * as Sentry from "@sentry/nextjs";

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
