import { createClient } from '@/lib/supabase/client';

export const categoriesApi = {
  // Get all categories for the current user
  getAll: async () => {
    const supabase = createClient();

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      throw new Error('User not authenticated');
    }

    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .or(`user_id.eq.${user.id},user_id.is.null`)
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
  create: async (categoryData: { name: string; icon: string; color: string }) => {
    const supabase = createClient();

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      throw new Error('User not authenticated');
    }

    const { data, error } = await supabase
      .from('categories')
      .insert({
        user_id: user.id,
        name: categoryData.name,
        icon: categoryData.icon,
        color: categoryData.color,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating category:', error);
      throw new Error(error.message || 'Failed to create category');
    }

    return data;
  },

  // Update an existing category
  update: async (id: string, categoryData: Partial<{ name: string; icon: string; color: string }>) => {
    const supabase = createClient();

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      throw new Error('User not authenticated');
    }

    const { data, error } = await supabase
      .from('categories')
      .update(categoryData)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) {
      console.error('Error updating category:', error);
      throw new Error(error.message || 'Failed to update category');
    }

    return data;
  },

  // Delete a category
  delete: async (id: string) => {
    const supabase = createClient();

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      throw new Error('User not authenticated');
    }

    const { error } = await supabase
      .from('categories')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      console.error('Error deleting category:', error);
      throw new Error(error.message || 'Failed to delete category');
    }
  },
};
