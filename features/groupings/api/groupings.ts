import { createClient } from '@/lib/supabase/client';
import { categoriesApi } from '@/features/categories/api/categories';
import { GROUPING } from '@/lib/constants';
import {
  dbCategoriesToDomain,
  dbParentCategoriesWithCountsToDomain,
} from '@/lib/types/data-transformers';

export const groupingsApi = {
  // Get all parent categories with aggregated transaction counts
  getAll: async () => {
    const supabase = createClient();

    const { data, error } = await supabase
      .from('parent_categories_with_counts')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      console.error(GROUPING.API.CONSOLE.FETCH_GROUPINGS, error);
      throw new Error(error.message || GROUPING.API.ERRORS.FETCH_ALL_FAILED);
    }

    // Transform snake_case to camelCase before returning to frontend
    return data ? dbParentCategoriesWithCountsToDomain(data) : [];
  },

  // Get children of a parent category
  getChildren: async (parentId: string) => {
    const supabase = createClient();

    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('parent_id', parentId)
      .order('name', { ascending: true });

    if (error) {
      console.error(GROUPING.API.CONSOLE.FETCH_CHILDREN, error);
      throw new Error(error.message || GROUPING.API.ERRORS.FETCH_CHILDREN_FAILED);
    }

    // Transform snake_case to camelCase before returning to frontend
    return data ? dbCategoriesToDomain(data) : [];
  },

  // Create parent category (reuses categories API)
  createParent: async (name: string, color: string) => {
    return categoriesApi.create({ name, color, parent_id: null });
  },

  // Update parent category
  updateParent: async (id: string, data: { name?: string; color?: string }) => {
    return categoriesApi.update(id, data);
  },

  // Delete parent category (validation happens in dialog)
  deleteParent: async (id: string) => {
    return categoriesApi.delete(id);
  },

  // Create subcategory under parent
  createSubcategory: async (name: string, parentId: string, color: string) => {
    return categoriesApi.create({ name, color, parent_id: parentId });
  },

  // Reassign subcategory to different parent
  reassignSubcategory: async (childId: string, newParentId: string) => {
    return categoriesApi.update(childId, { parent_id: newParentId });
  },
};
