/**
 * Reconciliations Repository Index
 *
 * Re-exports repository layer for clean imports.
 *
 * @module features/reconciliations/repository
 */

export type {
  IReconciliationsRepository,
  LinkUnlinkResult,
  CreateReconciliationInput,
  UpdateReconciliationInput,
} from './reconciliations-repository.interface';

export { SupabaseReconciliationsRepository } from './supabase-reconciliations-repository';
