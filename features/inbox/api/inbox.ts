import { createClient } from '@/lib/supabase/client';
import { INBOX } from '@/lib/constants';
import type { Database } from '@/types/database.types';
import type { PromoteInboxItemParams, CreateInboxItemParams, UpdateInboxItemParams, InboxItem } from '../types';
import {
  dbInboxItemsToDomain,
  domainInboxItemToDbInsert,
} from '@/lib/types/data-transformers';

export const inboxApi = {
  /**
   * Fetch Pending Items - Get all pending items with joined account/category data
   * Strict filtering: Only status='pending' items
   * Sort: Oldest first (FIFO) so users handle backlog chronologically
   * Includes joined data for display without additional lookups
   */
  getPending: async (): Promise<InboxItem[]> => {
    const supabase = createClient();

    const { data, error } = await supabase
      .from('transaction_inbox')
      .select(`
        *,
        account:bank_accounts(id, name, currency_code, global_currencies(symbol)),
        category:categories(id, name, color)
      `)
      .eq('status', 'pending')
      .order('date', { ascending: true }); // FIFO: Oldest first

    if (error) {
      console.error(`${INBOX.API.CONSOLE.ERROR_PREFIX} ${INBOX.API.CONSOLE.FETCH_ITEMS}`, error);
      throw new Error(error.message || INBOX.API.ERRORS.FETCH_FAILED);
    }

    // Transform with centralized transformer for null → undefined normalization
    return (data || []).map((item: any) => ({
      id: item.id,
      userId: item.user_id,
      amount: item.amount ?? undefined,              // Centralized normalization
      currency: item.currency,
      description: item.description ?? undefined,    // Centralized normalization
      date: item.date ?? undefined,                  // Centralized normalization
      sourceText: item.source_text ?? undefined,     // Centralized normalization
      accountId: item.account_id ?? undefined,       // Centralized normalization
      categoryId: item.category_id ?? undefined,     // Centralized normalization
      exchangeRate: item.exchange_rate ?? undefined, // Centralized normalization
      status: item.status,
      createdAt: item.created_at,
      updatedAt: item.updated_at,
      // Joined data
      account: item.account ? {
        id: item.account.id,
        name: item.account.name,
        currencyCode: item.account.currency_code,
        currencySymbol: item.account.global_currencies?.symbol ?? '',
      } : undefined,
      category: item.category ? {
        id: item.category.id,
        name: item.category.name,
        color: item.category.color,
      } : undefined,
    }));
  },

  /**
   * LEGACY: Fetch All - Get all pending items (without joins)
   * Use getPending() instead for better performance with joined data
   * @deprecated Use getPending() for new code
   */
  getAll: async () => {
    const supabase = createClient();

    const { data, error } = await supabase
      .from('transaction_inbox')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true }); // FIFO: Oldest first

    if (error) {
      console.error(`${INBOX.API.CONSOLE.ERROR_PREFIX} ${INBOX.API.CONSOLE.FETCH_ITEMS}`, error);
      throw new Error(error.message || INBOX.API.ERRORS.FETCH_FAILED);
    }

    // Transform snake_case to camelCase before returning to frontend
    return data ? dbInboxItemsToDomain(data) : [];
  },

  /**
   * Update Draft - Save account/category assignments without promoting to ledger
   * Supports bulk assignment workflows where user assigns categories to multiple items
   * Item remains in 'pending' status and stays in inbox
   */
  updateDraft: async (id: string, updates: UpdateInboxItemParams) => {
    const supabase = createClient();

    // Transform camelCase to snake_case for database
    const dbUpdates: Database['public']['Tables']['transaction_inbox']['Update'] = {};
    if (updates.accountId !== undefined) dbUpdates.account_id = updates.accountId;
    if (updates.categoryId !== undefined) dbUpdates.category_id = updates.categoryId;
    if (updates.description !== undefined) dbUpdates.description = updates.description;
    if (updates.amount !== undefined) dbUpdates.amount = updates.amount;
    if (updates.date !== undefined) dbUpdates.date = updates.date;
    if (updates.exchangeRate !== undefined) dbUpdates.exchange_rate = updates.exchangeRate;

    const { data, error } = await supabase
      .from('transaction_inbox')
      .update(dbUpdates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error(`${INBOX.API.CONSOLE.ERROR_PREFIX} Update draft failed:`, error);
      throw new Error('Could not save changes to draft');
    }

    return data;
  },

  /**
   * Promote Item - Move from inbox to ledger (The "Gatekeeper")
   * CRITICAL: Must call RPC function, NOT standard SQL INSERT
   * Requires all missing "Clean Data" (Account ID, Category ID)
   *
   * This function is ATOMIC - either the item is promoted and removed from inbox,
   * or the entire operation fails and nothing changes.
   *
   * VALIDATION: Can accept either PromoteInboxItemParams OR an InboxItem
   * If InboxItem is passed, it extracts the required fields from the item itself
   */
  promote: async (params: PromoteInboxItemParams | InboxItem) => {
    const supabase = createClient();

    // Extract parameters - support both param object and InboxItem
    let inboxId: string;
    let accountId: string;
    let categoryId: string;
    let finalDescription: string | undefined;
    let finalDate: string | undefined;
    let finalAmount: number | undefined;

    if ('inboxId' in params) {
      // PromoteInboxItemParams format
      inboxId = params.inboxId;
      accountId = params.accountId;
      categoryId = params.categoryId;
      finalDescription = params.finalDescription;
      finalDate = params.finalDate;
      finalAmount = params.finalAmount;
    } else {
      // InboxItem format - normalized by transformer (null already converted to undefined)
      inboxId = params.id;
      accountId = params.accountId || '';
      categoryId = params.categoryId || '';
      finalDescription = params.description;
      finalDate = params.date;
      finalAmount = params.amount;
    }

    // STRICT VALIDATION: Ensure we have the critical data points
    if (!accountId) {
      throw new Error(INBOX.API.ERRORS.MISSING_ACCOUNT);
    }
    if (!categoryId) {
      throw new Error(INBOX.API.ERRORS.MISSING_CATEGORY);
    }

    // Call the database RPC function that handles promotion atomically
    const { data, error } = await supabase.rpc('promote_inbox_item', {
      p_inbox_id: inboxId,
      p_account_id: accountId,
      p_category_id: categoryId,
      p_final_description: finalDescription,
      p_final_date: finalDate || new Date().toISOString(),
      p_final_amount: finalAmount,
    });

    if (error) {
      console.error(`${INBOX.API.CONSOLE.ERROR_PREFIX} ${INBOX.API.CONSOLE.PROMOTE_ITEM}`, error);
      throw new Error(error.message || INBOX.API.ERRORS.PROMOTE_FAILED);
    }

    return data;
  },

  /**
   * Dismiss Item - Mark as 'ignored' (The "Ignore" Button)
   * IMPORTANT: Do NOT DELETE the row - keep it as a "tombstone"
   * Reason: Prevents future duplicates (e.g., re-importing same bank CSV)
   */
  dismiss: async (inboxId: string) => {
    const supabase = createClient();

    const { error } = await supabase
      .from('transaction_inbox')
      .update({ status: 'ignored' })
      .eq('id', inboxId);

    if (error) {
      console.error(`${INBOX.API.CONSOLE.ERROR_PREFIX} ${INBOX.API.CONSOLE.DISMISS_ITEM}`, error);
      throw new Error(error.message || INBOX.API.ERRORS.DISMISS_FAILED);
    }
  },

  /**
   * Create Inbox Item - SCRATCHPAD MODE
   * ALL FIELDS ARE OPTIONAL - supports partial data entry
   * Used for rapid transaction capture with any level of completeness
   * FIX: Now accepts and persists accountId/categoryId (fixes data loss bug)
   */
  create: async (params: CreateInboxItemParams) => {
    const supabase = createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error(INBOX.API.ERRORS.USER_NOT_AUTHENTICATED);

    const insertData = domainInboxItemToDbInsert({
      userId: user.id,
      amount: params.amount,              // Transformer converts undefined → null
      description: params.description,    // Transformer converts undefined → null
      currency: params.currency,
      date: params.date,
      sourceText: params.sourceText,
      accountId: params.accountId,        // Transformer converts undefined → null
      categoryId: params.categoryId,      // Transformer converts undefined → null
      status: 'pending', // Always create as pending
    });

    const { data, error } = await supabase
      .from('transaction_inbox')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      console.error(`${INBOX.API.CONSOLE.ERROR_PREFIX} ${INBOX.API.CONSOLE.CREATE_ITEM}`, error);
      throw new Error(error.message || INBOX.API.ERRORS.CREATE_FAILED);
    }

    return data;
  },
};
