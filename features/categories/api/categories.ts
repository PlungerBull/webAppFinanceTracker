import { createClient } from '@/lib/supabase/client';
import { CATEGORY } from '@/lib/constants';

export const categoriesApi = {
  // Get all categories (user categories)
  // RLS ensures users only see their own categories
  getAll: async () => {
    const supabase = createClient();

    const { data, error } = await supabase
      .from('categories_with_counts')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      console.error(CATEGORY.API.CONSOLE.FETCH_CATEGORIES, error);
      throw new Error(error.message || CATEGORY.API.ERRORS.FETCH_ALL_FAILED);
    }

    return data;
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

    return data;
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

    return data;
  },

  // Update an existing category (RLS handles user filtering)
  update: async (id: string, category: { name?: string; color?: string; parent_id?: string | null }) => {
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

    return data;
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
