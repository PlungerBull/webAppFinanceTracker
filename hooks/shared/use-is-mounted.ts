/**
 * useIsMounted Hook
 *
 * CTO Standard: Hydration-safe client detection without setState-in-effect.
 *
 * Uses useSyncExternalStore to safely detect client-side rendering.
 * This avoids the react-hooks/set-state-in-effect lint error and
 * prevents hydration mismatches in Next.js.
 *
 * Usage:
 * ```typescript
 * const isMounted = useIsMounted();
 *
 * if (!isMounted) {
 *   return <Skeleton />;
 * }
 *
 * return <ClientOnlyComponent />;
 * ```
 *
 * @module use-is-mounted
 */

import { useSyncExternalStore } from 'react';

/**
 * Subscribe function (no-op since mount state never changes after initial render)
 */
function subscribe() {
  // Mount state is determined once and never changes
  return () => {};
}

/**
 * Get client-side snapshot (always true on client)
 */
function getSnapshot() {
  return true;
}

/**
 * Get server-side snapshot (always false during SSR)
 */
function getServerSnapshot() {
  return false;
}

/**
 * Hook to detect if component has mounted on the client.
 *
 * Uses useSyncExternalStore for proper React 18+ hydration handling.
 * Returns false during SSR and true after hydration completes.
 *
 * @returns true if running on client after hydration, false during SSR
 */
export function useIsMounted(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
