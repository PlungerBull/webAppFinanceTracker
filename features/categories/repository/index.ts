/**
 * Category Repository Exports
 *
 * @module category-repository
 */

// Interface
export type { ICategoryRepository } from './category-repository.interface';

// Implementation
export {
  SupabaseCategoryRepository,
  createCategoryRepository,
} from './supabase-category-repository';
