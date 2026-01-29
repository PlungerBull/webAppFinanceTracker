'use client';

import { useState, useEffect } from 'react';

const MOBILE_BREAKPOINT = 768; // md breakpoint

/**
 * Hook to detect mobile viewport
 * Uses matchMedia for SSR-safe detection
 * Returns true when viewport width is less than 768px (md breakpoint)
 */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);

    // Set initial value
    setIsMobile(mediaQuery.matches);

    // Listen for changes
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mediaQuery.addEventListener('change', handler);

    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  return isMobile;
}
