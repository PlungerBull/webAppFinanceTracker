import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';
import { SupabaseInboxRepository } from './supabase-inbox-repository';
import { VersionConflictError } from '../domain/errors';

// Mock Supabase Client
const mockSupabase = {
    from: vi.fn(),
    rpc: vi.fn(),
};

describe('SupabaseInboxRepository', () => {
    let repository: SupabaseInboxRepository;
    const userId = 'user-123';

    beforeEach(() => {
        vi.clearAllMocks();
        repository = new SupabaseInboxRepository(mockSupabase as unknown as SupabaseClient<Database>);
    });

    describe('update', () => {
        it('should throw VersionConflictError if update affects 0 rows (concurrent modification)', async () => {
            const inboxId = 'item-1';
            const lastKnownVersion = 5;
            const currentDbVersion = 6;

            // Mock update builder (transaction_inbox)
            const mockUpdateBuilder = {
                update: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
                select: vi.fn().mockResolvedValue({ data: [], error: null }), // 0 rows updated
            };

            // Mock select builder (transaction_inbox for fetching current version)
            const mockSelectBuilder = {
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
                single: vi.fn().mockResolvedValue({
                    data: { version: currentDbVersion },
                    error: null
                })
            };

            mockSupabase.from.mockImplementation((table: string) => {
                if (table === 'transaction_inbox') {
                    // We use transaction_inbox for BOTH update and fallback select.
                    // We need a super-object that handle both flows.
                    return {
                        ...mockUpdateBuilder,
                        ...mockSelectBuilder,
                        update: mockUpdateBuilder.update,
                        select: vi.fn((args) => {
                            // If update() was called before, select() takes no args usually in this repo logic?
                            // Actually, repository calls .update().eq().eq().select()
                            // Fallback calls .select('version').eq().eq().single()

                            if (args === 'version') {
                                return mockSelectBuilder.select(); // Logic for fallback
                            }
                            return mockUpdateBuilder.select(); // Logic for update check
                        })
                    };
                }
                return {};
            });

            const result = await repository.update(userId, inboxId, {
                description: 'New Desc',
                lastKnownVersion: lastKnownVersion,
            });

            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error).toBeInstanceOf(VersionConflictError);
                if (result.error instanceof VersionConflictError) {
                    expect(result.error.message).toContain(`expected ${lastKnownVersion}`);
                    expect(result.error.message).toContain(`found ${currentDbVersion}`);
                }
            } else {
                expect.fail('Expected update to fail with VersionConflictError');
            }
        });

        it('should succeed if versions match', async () => {
            const inboxId = 'item-1';
            const lastKnownVersion = 5;

            // Mock builders
            const mockUpdateBuilder = {
                update: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
                select: vi.fn().mockResolvedValue({ data: [{ id: inboxId }], error: null }),
            };

            const mockViewBuilder = {
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
                single: vi.fn().mockResolvedValue({
                    data: {
                        id: inboxId,
                        user_id: userId,
                        amount_original: 1000,
                        currency_original: null,
                        description: 'Success',
                        date: null,
                        source_text: null,
                        account_id: null,
                        account_name: null,
                        account_color: null,
                        category_id: null,
                        category_name: null,
                        category_color: null,
                        category_type: null,
                        exchange_rate: null,
                        notes: null,
                        version: lastKnownVersion + 1,
                        status: 'pending',
                        created_at: '2026-01-27T00:00:00.000Z',
                        updated_at: '2026-01-27T00:00:00.000Z',
                    },
                    error: null
                })
            };

            mockSupabase.from.mockImplementation((table: string) => {
                if (table === 'transaction_inbox') return mockUpdateBuilder;
                if (table === 'transaction_inbox_view') return mockViewBuilder;
                return {};
            });

            const result = await repository.update(userId, inboxId, {
                description: 'Success',
                lastKnownVersion: lastKnownVersion,
            });

            expect(result.success).toBe(true);
            // Verify update called with version check
            expect(mockUpdateBuilder.eq).toHaveBeenCalledWith('version', lastKnownVersion);
            // Verify getById called (view builder)
            expect(mockViewBuilder.select).toHaveBeenCalled();
        });
    });

    describe('promote', () => {
        it('should throw VersionConflictError if RPC returns P0001 code', async () => {
            const inboxId = 'item-1';
            const lastKnownVersion = 5;

            mockSupabase.rpc.mockResolvedValue({
                data: null,
                error: {
                    code: 'P0001',
                    message: 'Version conflict',
                    details: '',
                    hint: ''
                }
            });

            const result = await repository.promote(userId, {
                inboxId,
                accountId: 'acc-1',
                categoryId: 'cat-1',
                lastKnownVersion,
            });

            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error).toBeInstanceOf(VersionConflictError);
            } else {
                expect.fail('Expected promote to fail with VersionConflictError');
            }
        });
    });

    describe('dismiss', () => {
        it('should set deleted_at (Tombstone) when dismissing', async () => {
            const inboxId = 'item-1';

            const mockQueryBuilder = {
                update: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
            };

            // Mock update promise return
            mockQueryBuilder.eq.mockResolvedValue({ error: null });

            mockSupabase.from.mockReturnValue(mockQueryBuilder);

            await repository.dismiss(userId, inboxId);

            const updateCall = mockQueryBuilder.update.mock.calls[0][0];
            expect(updateCall).toHaveProperty('status', 'ignored');
            expect(updateCall).toHaveProperty('deleted_at');
        });
    });
});
