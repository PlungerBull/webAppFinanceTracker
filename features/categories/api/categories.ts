import { createClient } from '@/lib/supabase/client';

export const categoriesApi = {
  // Get all categories (user categories + global categories)
  // Note: This intentionally fetches both user-owned AND global (user_id IS NULL) categories
  // RLS ensures users only see their own + global categories
  getAll: async () => {
    const supabase = createClient();

    const { data, error } = await supabase
      .from('categories_with_counts')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      console.error('Error fetching categories:', error);
      throw new Error(error.message || 'Failed to fetch categories');
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
      console.error('Error fetching category:', error);
      throw new Error(error.message || 'Failed to fetch category');
    }

    return data;
  },

  // Create a new category
  create: async (category: { name: string; color: string }) => {
    const supabase = createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('categories')
      .insert({
        ...category,
        user_id: user.id,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating category:', error);
      throw new Error(error.message || 'Failed to create category');
    }

    return data;
  },

  // Update an existing category (RLS handles user filtering)
  update: async (id: string, category: { name?: string; color?: string }) => {
    const supabase = createClient();

    const { data, error } = await supabase
      .from('categories')
      .update(category)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating category:', error);
      throw new Error(error.message || 'Failed to update category');
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
      console.error('Error deleting category:', error);
      throw new Error(error.message || 'Failed to delete category');
    }
  },
};
