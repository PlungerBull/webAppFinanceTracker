'use client';

import { useSyncExternalStore } from 'react';

const MOBILE_BREAKPOINT = 768; // md breakpoint
const MEDIA_QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`;

/**
 * External store for media query state
 *
 * CTO MANDATE: useSyncExternalStore Pattern
 * - Concurrent-mode safe: No "flash of incorrect layout" during hydration
 * - Subscription-based: React manages the subscription lifecycle
 * - SSR-safe: getServerSnapshot returns false (mobile-first would return true)
 */

// Cache the MediaQueryList to avoid recreating on every render
let mediaQueryList: MediaQueryList | null = null;

function getMediaQueryList(): MediaQueryList | null {
  if (typeof window === 'undefined') return null;
  if (!mediaQueryList) {
    mediaQueryList = window.matchMedia(MEDIA_QUERY);
  }
  return mediaQueryList;
}

/**
 * Subscribe to media query changes
 * Returns cleanup function as required by useSyncExternalStore
 */
function subscribe(onStoreChange: () => void): () => void {
  const mql = getMediaQueryList();
  if (!mql) return () => {};

  mql.addEventListener('change', onStoreChange);
  return () => mql.removeEventListener('change', onStoreChange);
}

/**
 * Get current snapshot of media query state
 * Called during render - must be pure and return consistent value
 */
function getSnapshot(): boolean {
  const mql = getMediaQueryList();
  return mql ? mql.matches : false;
}

/**
 * Server snapshot - always false for SSR
 * Mobile detection requires client-side window access
 */
function getServerSnapshot(): boolean {
  return false;
}

/**
 * Hook to detect mobile viewport
 *
 * Uses useSyncExternalStore for:
 * - Concurrent-mode safety (no tearing)
 * - Proper hydration (no flash of wrong layout)
 * - Automatic subscription management
 *
 * @returns true when viewport width is less than 768px (md breakpoint)
 */
export function useIsMobile(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
