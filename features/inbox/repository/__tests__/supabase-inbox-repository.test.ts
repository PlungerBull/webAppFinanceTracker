import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';
import { SupabaseInboxRepository } from '@/features/inbox/repository/supabase-inbox-repository';
import { VersionConflictError } from '@/features/inbox/domain/errors';

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
        it('should throw VersionConflictError if RPC returns version_conflict error', async () => {
            const inboxId = 'item-1';
            const lastKnownVersion = 5;
            const currentDbVersion = 6;

            // Mock RPC call to return version conflict
            mockSupabase.rpc.mockResolvedValue({
                data: {
                    success: false,
                    error: 'version_conflict',
                    currentVersion: currentDbVersion,
                },
                error: null
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

            // Verify RPC was called with correct params
            expect(mockSupabase.rpc).toHaveBeenCalledWith('update_inbox_with_version', {
                p_inbox_id: inboxId,
                p_expected_version: lastKnownVersion,
                p_updates: { description: 'New Desc' },
            });
        });

        it('should succeed if versions match', async () => {
            const inboxId = 'item-1';
            const lastKnownVersion = 5;

            // Mock RPC call to return success
            mockSupabase.rpc.mockResolvedValue({
                data: { success: true, newVersion: lastKnownVersion + 1 },
                error: null
            });

            // Mock view builder for getById call after successful update
            const mockViewBuilder = {
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
                single: vi.fn().mockResolvedValue({
                    data: {
                        id: inboxId,
                        user_id: userId,
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
                        amount_cents: 1000,
                        deleted_at: null,
                    },
                    error: null
                })
            };

            mockSupabase.from.mockImplementation((table: string) => {
                if (table === 'transaction_inbox_view') return mockViewBuilder;
                return {};
            });

            const result = await repository.update(userId, inboxId, {
                description: 'Success',
                lastKnownVersion: lastKnownVersion,
            });

            expect(result.success).toBe(true);
            // Verify RPC was called
            expect(mockSupabase.rpc).toHaveBeenCalledWith('update_inbox_with_version', expect.any(Object));
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
        it('should call dismiss RPC with correct version (Tombstone pattern)', async () => {
            const inboxId = 'item-1';
            const currentVersion = 3;

            // Mock version fetch from transaction_inbox
            const mockSelectBuilder = {
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
                is: vi.fn().mockReturnThis(),
                single: vi.fn().mockResolvedValue({
                    data: { version: currentVersion },
                    error: null
                })
            };

            mockSupabase.from.mockImplementation((table: string) => {
                if (table === 'transaction_inbox') return mockSelectBuilder;
                return {};
            });

            // Mock RPC call to return success
            mockSupabase.rpc.mockResolvedValue({
                data: { success: true },
                error: null
            });

            const result = await repository.dismiss(userId, inboxId);

            expect(result.success).toBe(true);
            // Verify RPC was called with fetched version
            expect(mockSupabase.rpc).toHaveBeenCalledWith('dismiss_inbox_with_version', {
                p_inbox_id: inboxId,
                p_expected_version: currentVersion,
            });
        });
    });
});
