import { createClient } from '@/lib/supabase/client';
import { CATEGORY } from '@/lib/constants';
import {
  dbCategoryToDomain,
} from '@/lib/types/data-transformers';

export const categoriesApi = {
  // Get all categories (user categories)
  // RLS ensures users only see their own categories
  getAll: async () => {
    const supabase = createClient();

    // Fetch from categories table directly since categories_with_counts view is missing color field
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      console.error(CATEGORY.API.CONSOLE.FETCH_CATEGORIES, error);
      throw new Error(error.message || CATEGORY.API.ERRORS.FETCH_ALL_FAILED);
    }

    // Transform to domain type with transaction count as 0 (counts will be fetched separately if needed)
    return data ? data.map(cat => ({
      ...dbCategoryToDomain(cat),
      transactionCount: 0, // Transaction counts can be fetched separately if needed
    })) : [];
  },

  // Get a single category by ID
  getById: async (id: string) => {
    const supabase = createClient();

    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error(CATEGORY.API.CONSOLE.FETCH_CATEGORY, error);
      throw new Error(error.message || CATEGORY.API.ERRORS.FETCH_ONE_FAILED);
    }

    // Transform snake_case to camelCase before returning to frontend
    return dbCategoryToDomain(data);
  },

  // Create a new category
  create: async (category: { name: string; color: string; parent_id?: string | null; type?: 'income' | 'expense' }) => {
    const supabase = createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error(CATEGORY.API.ERRORS.USER_NOT_AUTHENTICATED);

    const { data, error } = await supabase
      .from('categories')
      .insert({
        ...category,
        user_id: user.id,
        type: category.type || 'expense', // Default to 'expense' if not provided
      })
      .select()
      .single();

    if (error) {
      console.error(CATEGORY.API.CONSOLE.CREATE_CATEGORY, error);
      throw new Error(error.message || CATEGORY.API.ERRORS.CREATE_FAILED);
    }

    // Transform snake_case to camelCase before returning to frontend
    return dbCategoryToDomain(data);
  },

  // Update an existing category (RLS handles user filtering)
  update: async (id: string, category: { name?: string; color?: string; parent_id?: string | null; type?: 'income' | 'expense' }) => {
    const supabase = createClient();

    const { data, error } = await supabase
      .from('categories')
      .update(category)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error(CATEGORY.API.CONSOLE.UPDATE_CATEGORY, error);
      throw new Error(error.message || CATEGORY.API.ERRORS.UPDATE_FAILED);
    }

    // Transform snake_case to camelCase before returning to frontend
    return dbCategoryToDomain(data);
  },

  // Delete a category (RLS handles user filtering)
  delete: async (id: string) => {
    const supabase = createClient();

    const { error } = await supabase
      .from('categories')
      .delete()
      .eq('id', id);

    if (error) {
      console.error(CATEGORY.API.CONSOLE.DELETE_CATEGORY, error);
      throw new Error(error.message || CATEGORY.API.ERRORS.DELETE_FAILED);
    }
  },
};
