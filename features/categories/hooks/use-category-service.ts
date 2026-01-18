/**
 * Category Service Hook
 *
 * Dependency injection hook for category service.
 * Memoizes service instance for React component lifecycle.
 *
 * @module use-category-service
 */

import { useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { createSupabaseAuthProvider } from '@/lib/auth/supabase-auth-provider';
import { createCategoryRepository } from '../repository';
import { createCategoryService, type ICategoryService } from '../services';

/**
 * Use Category Service
 *
 * Creates and memoizes a category service instance.
 * Uses dependency injection pattern for testability.
 *
 * @returns Category service instance
 *
 * @example
 * ```typescript
 * function CategoryList() {
 *   const service = useCategoryService();
 *
 *   useEffect(() => {
 *     service.getAll().then(setCategories);
 *   }, []);
 * }
 * ```
 */
export function useCategoryService(): ICategoryService {
  return useMemo(() => {
    const supabase = createClient();
    const repository = createCategoryRepository(supabase);
    const authProvider = createSupabaseAuthProvider(supabase);
    return createCategoryService(repository, authProvider);
  }, []);
}
