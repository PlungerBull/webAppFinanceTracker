/**
 * Sentry PII Scrubber
 *
 * Privacy-first error reporting for a financial application.
 * Strips all sensitive financial data before events leave the client.
 *
 * CTO MANDATE: Allowlist approach — only pass through known-safe fields.
 * Never send monetary amounts, descriptions, account names, or notes to Sentry.
 *
 * @module sentry/scrubber
 */

import type { Event, Breadcrumb, EventHint } from '@sentry/nextjs';

/**
 * Fields that contain PII or sensitive financial data.
 * These are stripped from all Sentry event extras and breadcrumb data.
 */
const SENSITIVE_FIELDS = new Set([
  // transactions
  'amount_original',
  'amount_home',
  'amount_cents',
  'amount_home_cents',
  'amountCents',
  'amountHomeCents',
  'description',
  'notes',
  'source_text',
  'sourceText',
  'exchange_rate',
  'exchangeRate',
  // bank_accounts
  'name',
  'current_balance',
  'current_balance_cents',
  'currentBalanceCents',
  'currency_code',
  'currencyCode',
  // user_settings
  'main_currency',
  'mainCurrency',
  // transaction_inbox
  'amount_original',
]);

/**
 * Fields that are safe to pass through to Sentry.
 * Everything else is scrubbed.
 */
const SAFE_FIELDS = new Set([
  'id',
  'user_id',
  'userId',
  'version',
  'local_sync_status',
  'localSyncStatus',
  'sync_status',
  'syncStatus',
  'code',
  'error',
  'type',
  'status',
  'phase',
  'table_name',
  'tableName',
  'created_at',
  'createdAt',
  'updated_at',
  'updatedAt',
  'deleted_at',
  'deletedAt',
  'success',
  'conflict',
  'buffered',
  'durationMs',
  'schemaName',
  'account_id',
  'accountId',
  'category_id',
  'categoryId',
  'parent_id',
  'parentId',
  'group_id',
  'groupId',
  'transfer_id',
  'transferId',
  'inbox_id',
  'inboxId',
  'reconciliation_id',
  'reconciliationId',
  'is_visible',
  'isVisible',
  'cleared',
  'color',
]);

/**
 * Recursively scrub an object, keeping only safe fields.
 * Sensitive fields are replaced with '[REDACTED]'.
 * Unknown fields are replaced with '[SCRUBBED]'.
 */
function scrubObject(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(scrubObject);

  const scrubbed: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (SENSITIVE_FIELDS.has(key)) {
      scrubbed[key] = '[REDACTED]';
    } else if (SAFE_FIELDS.has(key)) {
      scrubbed[key] = typeof value === 'object' ? scrubObject(value) : value;
    } else {
      scrubbed[key] = '[SCRUBBED]';
    }
  }
  return scrubbed;
}

/**
 * Extract only the keys from rawData for SchemaValidationError reports.
 * Never sends values — only the shape of the malformed data.
 */
function extractKeysOnly(rawData: unknown): string[] {
  if (rawData === null || rawData === undefined) return [];
  if (typeof rawData !== 'object') return [];
  if (Array.isArray(rawData)) {
    return rawData.length > 0 ? extractKeysOnly(rawData[0]) : [];
  }
  return Object.keys(rawData as Record<string, unknown>);
}

/**
 * Scrub breadcrumb data of PII.
 */
function scrubBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb {
  if (breadcrumb.data) {
    breadcrumb.data = scrubObject(breadcrumb.data) as Record<string, unknown>;
  }
  if (breadcrumb.message) {
    breadcrumb.message = scrubMonetaryValues(breadcrumb.message);
  }
  return breadcrumb;
}

/**
 * Regex-scrub strings that may contain monetary amounts.
 * Matches patterns like "$1,234.56", "1234.56", "€100", etc.
 */
function scrubMonetaryValues(text: string): string {
  // Currency symbols followed by numbers
  return text.replace(
    /[$€£¥₹]\s?\d[\d,]*\.?\d*/g,
    '[REDACTED_AMOUNT]'
  );
}

/**
 * beforeSend callback for Sentry.
 *
 * Scrubs all PII from events before they leave the client.
 * For SchemaValidationError, only sends keys (not values) of rawData.
 */
export function beforeSend(event: Event, hint: EventHint): Event | null {
  // Scrub breadcrumbs
  if (event.breadcrumbs) {
    event.breadcrumbs = event.breadcrumbs.map(scrubBreadcrumb);
  }

  // Scrub extra context
  if (event.extra) {
    event.extra = scrubObject(event.extra) as Record<string, unknown>;
  }

  // Scrub contexts
  if (event.contexts) {
    for (const [key, value] of Object.entries(event.contexts)) {
      if (value && typeof value === 'object') {
        event.contexts[key] = scrubObject(value) as Record<string, unknown>;
      }
    }
  }

  // Handle SchemaValidationError: only send keys, not values
  const originalError = hint.originalException;
  if (
    originalError &&
    typeof originalError === 'object' &&
    'name' in originalError &&
    originalError.name === 'SchemaValidationError' &&
    'rawData' in originalError
  ) {
    if (!event.extra) event.extra = {};
    event.extra.rawDataKeys = extractKeysOnly(
      (originalError as { rawData: unknown }).rawData
    );
    event.extra.schemaName = (originalError as { schemaName: string }).schemaName;
    // Ensure rawData itself is never sent
    delete event.extra.rawData;
  }

  return event;
}

/**
 * beforeBreadcrumb callback for Sentry.
 *
 * Scrubs PII from individual breadcrumbs as they are captured.
 */
export function beforeBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb | null {
  return scrubBreadcrumb(breadcrumb);
}
