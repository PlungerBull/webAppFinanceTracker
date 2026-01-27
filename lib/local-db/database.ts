/**
 * WatermelonDB Database Singleton
 *
 * Provides lazy initialization of WatermelonDB with proper SSR handling.
 *
 * CTO MANDATES:
 * - SSR Isolation: Return null when typeof window === 'undefined'
 * - Singleton Pattern: One database instance per client session
 * - Graceful Degradation: Handle IndexedDB unavailability
 *
 * @module local-db/database
 */

import { Database } from '@nozbe/watermelondb';
import LokiJSAdapter from '@nozbe/watermelondb/adapters/lokijs';
import { schema } from './schema';
import { migrations } from './migrations';
import { modelClasses } from './models';

/**
 * Database instance singleton
 * Null until initialized (or if SSR/IndexedDB unavailable)
 */
let databaseInstance: Database | null = null;

/**
 * Database initialization state
 */
let initializationPromise: Promise<Database | null> | null = null;

/**
 * Error from last initialization attempt
 */
let initializationError: Error | null = null;

/**
 * Database name for IndexedDB
 */
const DATABASE_NAME = 'finance_tracker_local';

/**
 * Get the WatermelonDB database instance
 *
 * CTO MANDATE: SSR Isolation
 * Returns null immediately when running on server.
 * On client, lazy-initializes database on first call.
 *
 * @returns Promise resolving to Database instance or null
 *
 * @example
 * ```typescript
 * const db = await getLocalDatabase();
 * if (db) {
 *   const accounts = await db.get('bank_accounts').query().fetch();
 * }
 * ```
 */
export async function getLocalDatabase(): Promise<Database | null> {
  // CTO MANDATE: SSR Isolation - return null on server
  if (typeof window === 'undefined') {
    return null;
  }

  // Return cached instance if available
  if (databaseInstance) {
    return databaseInstance;
  }

  // Return cached error state
  if (initializationError) {
    console.warn('[LocalDB] Previous initialization failed:', initializationError);
    return null;
  }

  // Deduplicate concurrent initialization attempts
  if (initializationPromise) {
    return initializationPromise;
  }

  // Initialize database
  initializationPromise = initializeDatabase();
  return initializationPromise;
}

/**
 * Internal database initialization
 *
 * Creates LokiJS adapter with IndexedDB persistence.
 * Falls back to null if IndexedDB is unavailable.
 */
async function initializeDatabase(): Promise<Database | null> {
  try {
    // Check IndexedDB availability
    if (!isIndexedDBAvailable()) {
      console.warn('[LocalDB] IndexedDB not available. Running in online-only mode.');
      return null;
    }

    // Create LokiJS adapter with IndexedDB persistence
    const adapter = new LokiJSAdapter({
      schema,
      migrations,
      dbName: DATABASE_NAME,
      // Use incremental IndexedDB for better performance
      useIncrementalIndexedDB: true,
      // Enable web worker for non-blocking operations
      useWebWorker: true,
      // Handle worker errors gracefully
      onSetUpError: (error: Error) => {
        console.error('[LocalDB] Setup error:', error);
        initializationError = error;
      },
    });

    // Create database instance
    const database = new Database({
      adapter,
      modelClasses: [...modelClasses],
    });

    // Store singleton
    databaseInstance = database;

    console.log('[LocalDB] Database initialized successfully');
    return database;
  } catch (error) {
    initializationError = error instanceof Error ? error : new Error(String(error));
    console.error('[LocalDB] Initialization failed:', initializationError);
    return null;
  } finally {
    // Clear promise to allow retry on next call
    initializationPromise = null;
  }
}

/**
 * Check if IndexedDB is available
 *
 * Returns false in:
 * - Private browsing mode (some browsers)
 * - SSR environment
 * - Environments without IndexedDB support
 */
function isIndexedDBAvailable(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  try {
    // Basic availability check
    if (!window.indexedDB) {
      return false;
    }

    // Test actual functionality (some private modes expose indexedDB but throw on use)
    const testRequest = window.indexedDB.open('__test__');
    testRequest.onerror = () => {
      // Clean up test database reference
    };
    testRequest.onsuccess = () => {
      // Clean up test database
      const db = testRequest.result;
      db.close();
      try {
        window.indexedDB.deleteDatabase('__test__');
      } catch {
        // Ignore cleanup errors
      }
    };

    return true;
  } catch {
    return false;
  }
}

/**
 * Reset database (for testing/debugging)
 *
 * Warning: Destroys all local data.
 * Use only for development/testing.
 */
export async function resetLocalDatabase(): Promise<void> {
  if (typeof window === 'undefined') {
    return;
  }

  if (databaseInstance) {
    // WatermelonDB doesn't have a built-in reset method
    // We need to clear all tables manually or delete IndexedDB
    try {
      await window.indexedDB.deleteDatabase(DATABASE_NAME);
      databaseInstance = null;
      initializationPromise = null;
      initializationError = null;
      console.log('[LocalDB] Database reset complete');
    } catch (error) {
      console.error('[LocalDB] Reset failed:', error);
    }
  }
}

/**
 * Get database initialization error (if any)
 *
 * Useful for displaying error state in UI.
 */
export function getLocalDatabaseError(): Error | null {
  return initializationError;
}

/**
 * Check if database is initialized
 */
export function isLocalDatabaseReady(): boolean {
  return databaseInstance !== null;
}
