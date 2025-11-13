import { createClient } from '@/lib/supabase/client';

export const currenciesApi = {
  /**
   * Get all currencies for the current user
   */
  getAll: async () => {
    const supabase = createClient();

    const { data, error } = await supabase
      .from('currencies')
      .select('*')
      .order('code', { ascending: true });

    if (error) {
      console.error('Error fetching currencies:', error);
      throw new Error(error.message || 'Failed to fetch currencies');
    }

    return data;
  },

  /**
   * Add a new currency for the current user
   */
  add: async (code: string) => {
    const supabase = createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new Error('User not authenticated');
    }

    const { data, error } = await supabase
      .from('currencies')
      .insert({
        user_id: user.id,
        code: code.toUpperCase(),
        is_main: false,
      })
      .select()
      .single();

    if (error) {
      console.error('Error adding currency:', error);
      throw new Error(error.message || 'Failed to add currency');
    }

    return data;
  },
};
