/**
 * Unit Tests for usePromoteInboxItem Hook
 *
 * Tests the VERSION_CONFLICT auto-retry logic (OCC):
 * - Bounded retry loop with jittered backoff
 * - Pull-before-promote when version is suspicious
 * - Max retry exhaustion
 * - getById failure during retry
 *
 * @module use-inbox-test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { INBOX_ERROR_CODES, PROMOTE_MAX_RETRIES } from '../../domain/constants';
import type { InboxError } from '../../domain/types';
import type { InboxItemViewEntity } from '@/domain/inbox';

// ---------------------------------------------------------------------------
// Mock the inbox service singleton
// vi.hoisted() lifts these above the vi.mock hoist to avoid TDZ errors
// ---------------------------------------------------------------------------
const {
  mockPromote,
  mockGetById,
  mockGetPendingPaginated,
  mockUpdate,
  mockDismiss,
  mockCreate,
  mockCreateBatch,
  mockUpdateBatch,
} = vi.hoisted(() => ({
  mockPromote: vi.fn(),
  mockGetById: vi.fn(),
  mockGetPendingPaginated: vi.fn(),
  mockUpdate: vi.fn(),
  mockDismiss: vi.fn(),
  mockCreate: vi.fn(),
  mockCreateBatch: vi.fn(),
  mockUpdateBatch: vi.fn(),
}));

vi.mock('../../services/inbox-service', () => ({
  getInboxService: () => ({
    promote: mockPromote,
    getById: mockGetById,
    getPendingPaginated: mockGetPendingPaginated,
    update: mockUpdate,
    dismiss: mockDismiss,
    create: mockCreate,
    createBatch: mockCreateBatch,
    updateBatch: mockUpdateBatch,
  }),
}));

import { usePromoteInboxItem } from '../use-inbox';

// ---------------------------------------------------------------------------
// Test Helpers
// ---------------------------------------------------------------------------

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

function createWrapper() {
  const queryClient = createTestQueryClient();
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(
      QueryClientProvider,
      { client: queryClient },
      children
    );
  };
}

// ---------------------------------------------------------------------------
// Test Fixtures
// ---------------------------------------------------------------------------

const testInboxItem: InboxItemViewEntity = {
  id: 'inbox-1',
  userId: 'user-123',
  amountCents: 1050,
  currencyCode: 'USD',
  description: 'Coffee',
  date: '2024-01-15T10:30:00.000Z',
  sourceText: null,
  accountId: 'acc-1',
  categoryId: 'cat-1',
  exchangeRate: null,
  notes: null,
  status: 'pending',
  createdAt: '2024-01-15T10:00:00.000Z',
  updatedAt: '2024-01-15T10:00:00.000Z',
  version: 2,
  deletedAt: null,
};

const promoteDTO = {
  inboxId: 'inbox-1',
  accountId: 'acc-1',
  categoryId: 'cat-1',
  finalAmountCents: 1050,
  lastKnownVersion: 1,
};

const versionConflictError: InboxError = {
  code: INBOX_ERROR_CODES.VERSION_CONFLICT,
  message: 'Version conflict for item inbox-1: expected 1, found 2',
};

const promoteSuccess = {
  success: true as const,
  data: { transactionId: 'txn-1', inboxId: 'inbox-1' },
};

const conflictResult = {
  success: false as const,
  data: null,
  error: versionConflictError,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('usePromoteInboxItem', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return data on successful promotion (no conflict)', async () => {
    mockPromote.mockResolvedValue(promoteSuccess);

    const { result } = renderHook(() => usePromoteInboxItem(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.mutate(promoteDTO);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(promoteSuccess.data);
    expect(mockPromote).toHaveBeenCalledTimes(1);
    expect(mockGetById).not.toHaveBeenCalled();
  });

  it('should auto-retry on VERSION_CONFLICT and succeed', async () => {
    // First call: version conflict
    mockPromote.mockResolvedValueOnce(conflictResult);
    // getById returns fresh version
    mockGetById.mockResolvedValueOnce({
      success: true,
      data: { ...testInboxItem, version: 2 },
    });
    // Second call (retry): success
    mockPromote.mockResolvedValueOnce(promoteSuccess);

    const { result } = renderHook(() => usePromoteInboxItem(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.mutate(promoteDTO);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockPromote).toHaveBeenCalledTimes(2);
    expect(mockGetById).toHaveBeenCalledWith('inbox-1');
    // Verify retry used fresh version
    expect(mockPromote).toHaveBeenLastCalledWith(
      expect.objectContaining({ lastKnownVersion: 2 })
    );
    expect(result.current.data).toEqual(promoteSuccess.data);
  });

  it('should exhaust MAX_RETRIES and throw when conflict persists', async () => {
    // Every promote call returns version conflict
    mockPromote.mockResolvedValue(conflictResult);
    // getById always returns a fresh version (but server keeps conflicting)
    mockGetById.mockResolvedValue({
      success: true,
      data: { ...testInboxItem, version: 99 },
    });

    const { result } = renderHook(() => usePromoteInboxItem(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.mutate(promoteDTO);
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    // 1 initial + PROMOTE_MAX_RETRIES retries
    expect(mockPromote).toHaveBeenCalledTimes(1 + PROMOTE_MAX_RETRIES);
    expect(mockGetById).toHaveBeenCalledTimes(PROMOTE_MAX_RETRIES);
    expect((result.current.error as Error).message).toBe(versionConflictError.message);
  });

  it('should break retry loop when getById fails', async () => {
    // First call: version conflict
    mockPromote.mockResolvedValueOnce(conflictResult);
    // getById fails
    mockGetById.mockResolvedValueOnce({
      success: false,
      data: null,
      error: { code: 'REPOSITORY_ERROR', message: 'DB down' },
    });

    const { result } = renderHook(() => usePromoteInboxItem(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.mutate(promoteDTO);
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    // Falls through to the generic error handler with the version conflict message
    expect((result.current.error as Error).message).toBe(versionConflictError.message);
    // promote called once, getById called once, no retry promote
    expect(mockPromote).toHaveBeenCalledTimes(1);
    expect(mockGetById).toHaveBeenCalledTimes(1);
  });

  it('should pull-before-promote when lastKnownVersion is undefined', async () => {
    const dtoWithoutVersion = {
      inboxId: 'inbox-1',
      accountId: 'acc-1',
      categoryId: 'cat-1',
    };

    // getById for prefetch (pull-before-promote guard)
    mockGetById.mockResolvedValueOnce({
      success: true,
      data: { ...testInboxItem, version: 5 },
    });
    // promote succeeds
    mockPromote.mockResolvedValueOnce(promoteSuccess);

    const { result } = renderHook(() => usePromoteInboxItem(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.mutate(dtoWithoutVersion);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // getById called for prefetch, promote called with fresh version
    expect(mockGetById).toHaveBeenCalledWith('inbox-1');
    expect(mockPromote).toHaveBeenCalledWith(
      expect.objectContaining({ lastKnownVersion: 5 })
    );
  });

  it('should not retry on non-VERSION_CONFLICT errors', async () => {
    const repositoryError: InboxError = {
      code: INBOX_ERROR_CODES.REPOSITORY_ERROR,
      message: 'Database connection lost',
    };

    mockPromote.mockResolvedValue({
      success: false,
      data: null,
      error: repositoryError,
    });

    const { result } = renderHook(() => usePromoteInboxItem(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.mutate(promoteDTO);
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    // Only one promote call — no retry for non-conflict errors
    expect(mockPromote).toHaveBeenCalledTimes(1);
    expect(mockGetById).not.toHaveBeenCalled();
    expect((result.current.error as Error).message).toBe('Database connection lost');
  });

  it('should use typed constants (not magic strings) for error code matching', () => {
    // Compile-time guarantee smoke test
    expect(INBOX_ERROR_CODES.VERSION_CONFLICT).toBe('VERSION_CONFLICT');
    expect(PROMOTE_MAX_RETRIES).toBe(3);
  });
});
