/**
 * Shared Data Patterns
 *
 * Cross-feature types for repository pattern operations.
 * Import from this module in all feature domain layers.
 *
 * @example
 * ```typescript
 * import type { DataResult, PaginatedResult, PaginationOptions } from '@/lib/data-patterns';
 * ```
 *
 * @module data-patterns
 */

export type {
  DataResult,
  PaginatedResult,
  PaginationOptions,
  SyncResponse,
  SerializableError,
} from './types';
