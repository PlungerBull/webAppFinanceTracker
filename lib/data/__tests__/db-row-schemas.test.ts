import { describe, it, expect } from 'vitest';
import {
  BankAccountRowSchema,
  BankAccountViewRowSchema,
  TransactionRowSchema,
  CategoryRowSchema,
  TransactionInboxRowSchema,
  UserSettingsRowSchema,
  ReconciliationRowSchema,
  ReconciliationSummaryRpcSchema,
  SyncChangesSummarySchema,
  ChangesResponseSchema,
  SyncRecordSchemas,
} from '../db-row-schemas';

// ============================================================================
// TEST FIXTURES
// ============================================================================

const UUID = '550e8400-e29b-41d4-a716-446655440000';
const UUID2 = '550e8400-e29b-41d4-a716-446655440001';
const TIMESTAMP = '2026-01-27T12:00:00.000Z';

const validBankAccount = {
  id: UUID,
  group_id: UUID2,
  user_id: UUID,
  name: 'Chase Checking',
  type: 'checking' as const,
  currency_code: 'USD',
  color: '#3B82F6',
  is_visible: true,
  current_balance_cents: 105000,
  created_at: TIMESTAMP,
  updated_at: TIMESTAMP,
  version: 1,
  deleted_at: null,
};

const validTransaction = {
  id: UUID,
  user_id: UUID,
  account_id: UUID2,
  category_id: UUID,
  amount_original: 1050,
  amount_home: 1050,
  exchange_rate: 1.0,
  date: '2026-01-27',
  description: 'Coffee',
  notes: null,
  source_text: null,
  transfer_id: null,
  inbox_id: null,
  cleared: false,
  reconciliation_id: null,
  created_at: TIMESTAMP,
  updated_at: TIMESTAMP,
  version: 1,
  deleted_at: null,
};

const validCategory = {
  id: UUID,
  user_id: UUID,
  name: 'Groceries',
  type: 'expense' as const,
  color: '#10B981',
  parent_id: null,
  created_at: TIMESTAMP,
  updated_at: TIMESTAMP,
  version: 1,
  deleted_at: null,
};

// ============================================================================
// TABLE ROW SCHEMA TESTS
// ============================================================================

describe('BankAccountRowSchema', () => {
  it('accepts valid bank account', () => {
    expect(BankAccountRowSchema.parse(validBankAccount)).toEqual(validBankAccount);
  });

  it('accepts with optional sync fields', () => {
    const withSync = { ...validBankAccount, version: 3, deleted_at: null };
    expect(BankAccountRowSchema.parse(withSync)).toEqual(withSync);
  });

  it('rejects missing required field', () => {
    const { name: _, ...noName } = validBankAccount;
    expect(() => BankAccountRowSchema.parse(noName)).toThrow();
  });

  it('rejects invalid account type', () => {
    expect(() => BankAccountRowSchema.parse({ ...validBankAccount, type: 'bitcoin' })).toThrow();
  });
});

describe('BankAccountViewRowSchema', () => {
  it('accepts with global_currencies JOIN', () => {
    const row = { ...validBankAccount, global_currencies: { symbol: '$' } };
    expect(BankAccountViewRowSchema.parse(row).global_currencies).toEqual({ symbol: '$' });
  });

  it('accepts null global_currencies (failed JOIN)', () => {
    const row = { ...validBankAccount, global_currencies: null };
    expect(BankAccountViewRowSchema.parse(row).global_currencies).toBeNull();
  });
});

describe('TransactionRowSchema', () => {
  it('accepts valid transaction', () => {
    expect(TransactionRowSchema.parse(validTransaction)).toEqual(validTransaction);
  });

  it('rejects float amount_original (integer cents enforcement)', () => {
    expect(() => TransactionRowSchema.parse({
      ...validTransaction, amount_original: 10.50,
    })).toThrow();
  });

  it('rejects float amount_home (integer cents enforcement)', () => {
    expect(() => TransactionRowSchema.parse({
      ...validTransaction, amount_home: 10.50,
    })).toThrow();
  });

  it('accepts nullable fields as null', () => {
    const withNulls = { ...validTransaction, category_id: null };
    const result = TransactionRowSchema.parse(withNulls);
    expect(result.category_id).toBeNull();
    expect(result.notes).toBeNull();
    expect(result.deleted_at).toBeNull();
  });
});

describe('CategoryRowSchema', () => {
  it('accepts valid category', () => {
    expect(CategoryRowSchema.parse(validCategory)).toEqual(validCategory);
  });

  it('accepts with sync fields', () => {
    const withSync = { ...validCategory, version: 2, deleted_at: TIMESTAMP };
    expect(CategoryRowSchema.parse(withSync)).toEqual(withSync);
  });

  it('rejects invalid type', () => {
    expect(() => CategoryRowSchema.parse({ ...validCategory, type: 'debit' })).toThrow();
  });
});

describe('TransactionInboxRowSchema', () => {
  it('accepts valid inbox item', () => {
    const item = {
      id: UUID,
      user_id: UUID,
      amount_cents: 500,
      description: 'Gas',
      date: '2026-01-27',
      source_text: null,
      account_id: null,
      category_id: null,
      exchange_rate: null,
      notes: null,
      status: 'pending',
      created_at: TIMESTAMP,
      updated_at: TIMESTAMP,
      version: 1,
      deleted_at: null,
    };
    expect(TransactionInboxRowSchema.parse(item)).toEqual(item);
  });

  it('accepts null amount_cents (scratchpad mode)', () => {
    const item = {
      id: UUID, user_id: UUID, amount_cents: null, description: null,
      date: null, source_text: null, account_id: null, category_id: null,
      exchange_rate: null, notes: null, status: 'pending',
      created_at: TIMESTAMP, updated_at: TIMESTAMP,
      version: 1, deleted_at: null,
    };
    expect(TransactionInboxRowSchema.parse(item).amount_cents).toBeNull();
  });
});

describe('UserSettingsRowSchema', () => {
  it('accepts valid settings', () => {
    const settings = {
      user_id: UUID,
      main_currency: 'USD',
      start_of_week: 1,
      theme: 'dark',
      transaction_sort_preference: 'date',
      created_at: TIMESTAMP,
      updated_at: TIMESTAMP,
    };
    expect(UserSettingsRowSchema.parse(settings)).toEqual(settings);
  });

  it('accepts nullable fields', () => {
    const settings = {
      user_id: UUID,
      main_currency: null,
      start_of_week: null,
      theme: null,
      transaction_sort_preference: 'created_at',
      created_at: TIMESTAMP,
      updated_at: TIMESTAMP,
    };
    expect(UserSettingsRowSchema.parse(settings).main_currency).toBeNull();
  });
});

describe('ReconciliationRowSchema', () => {
  it('accepts valid reconciliation', () => {
    const recon = {
      id: UUID, user_id: UUID, account_id: UUID2,
      name: 'Jan 2026', beginning_balance_cents: 100000, ending_balance_cents: 120000,
      date_start: '2026-01-01', date_end: '2026-01-31',
      status: 'draft' as const,
      created_at: TIMESTAMP, updated_at: TIMESTAMP,
      version: 1, deleted_at: null,
    };
    expect(ReconciliationRowSchema.parse(recon)).toEqual(recon);
  });

  it('rejects float balance (integer cents enforcement)', () => {
    expect(() => ReconciliationRowSchema.parse({
      id: UUID, user_id: UUID, account_id: UUID2,
      name: 'Test', beginning_balance_cents: 100.5, ending_balance_cents: 200,
      date_start: null, date_end: null, status: 'draft',
      created_at: TIMESTAMP, updated_at: TIMESTAMP,
      version: 1, deleted_at: null,
    })).toThrow();
  });
});

// ============================================================================
// RPC SCHEMA TESTS
// ============================================================================

describe('ReconciliationSummaryRpcSchema', () => {
  it('accepts valid summary', () => {
    const summary = {
      beginningBalanceCents: 100000, endingBalanceCents: 120000,
      linkedSumCents: 20000, linkedCount: 5,
      differenceCents: 0, isBalanced: true,
    };
    expect(ReconciliationSummaryRpcSchema.parse(summary)).toEqual(summary);
  });
});

describe('SyncChangesSummarySchema', () => {
  it('accepts valid summary', () => {
    const summary = { has_changes: true, latest_server_version: 42, since_version: 40 };
    expect(SyncChangesSummarySchema.parse(summary)).toEqual(summary);
  });

  it('rejects non-integer version', () => {
    expect(() => SyncChangesSummarySchema.parse({
      has_changes: true, latest_server_version: 42.5, since_version: 40,
    })).toThrow();
  });
});

describe('ChangesResponseSchema', () => {
  it('accepts valid response with records', () => {
    const resp = { records: [{ id: '1', name: 'test' }] };
    expect(ChangesResponseSchema.parse(resp)).toEqual(resp);
  });

  it('accepts empty records array', () => {
    expect(ChangesResponseSchema.parse({ records: [] }).records).toEqual([]);
  });
});

// ============================================================================
// SYNC RECORD SCHEMA TESTS
// ============================================================================

describe('SyncRecordSchemas', () => {
  it('bank_accounts passthrough allows extra fields', () => {
    const record = {
      id: UUID, group_id: UUID2, user_id: UUID,
      name: 'Test', type: 'checking', currency_code: 'USD',
      color: '#000', is_visible: true, current_balance_cents: 50000,
      created_at: TIMESTAMP, updated_at: TIMESTAMP,
      version: 1, deleted_at: null,
      some_new_column: 'extra', // extra field from migration
    };
    const result = SyncRecordSchemas.bank_accounts.parse(record);
    expect(result.some_new_column).toBe('extra');
  });

  it('transactions rejects float amount_cents', () => {
    const record = {
      id: UUID, user_id: UUID, account_id: UUID2, category_id: null,
      amount_cents: 10.5, // FLOAT - should fail
      amount_home_cents: 1050,
      exchange_rate: 1, date: '2026-01-27',
      description: null, notes: null, source_text: null,
      transfer_id: null, inbox_id: null, cleared: false,
      reconciliation_id: null,
      created_at: TIMESTAMP, updated_at: TIMESTAMP,
      version: 1, deleted_at: null,
    };
    expect(() => SyncRecordSchemas.transactions.parse(record)).toThrow();
  });

  it('categories validates all required fields', () => {
    const record = {
      id: UUID, user_id: null, name: 'Food', type: 'expense',
      color: '#000', parent_id: null,
      created_at: TIMESTAMP, updated_at: TIMESTAMP,
      version: 1, deleted_at: null,
    };
    expect(SyncRecordSchemas.categories.parse(record)).toBeTruthy();
  });

  it('transaction_inbox accepts nullable amount_cents', () => {
    const record = {
      id: UUID, user_id: UUID, amount_cents: null,
      description: null, date: null, source_text: null,
      account_id: null, category_id: null, exchange_rate: null,
      notes: null, status: 'pending',
      created_at: TIMESTAMP, updated_at: TIMESTAMP,
      version: 1, deleted_at: null,
    };
    expect(SyncRecordSchemas.transaction_inbox.parse(record).amount_cents).toBeNull();
  });
});
