import { createClient } from '@/lib/supabase/client';

export const currenciesApi = {
  /**
   * Get all currencies for the current user (RLS handles user filtering)
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

    return data || [];
  },

  /**
 * Add a new currency for the current user
 * Uses upsert to gracefully handle duplicates
 */
add: async (code: string) => {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('User not authenticated');
  }

  // Use upsert to handle duplicates gracefully
  const { data, error } = await supabase
    .from('currencies')
    .upsert(
      {
        user_id: user.id,
        code: code.toUpperCase(),
        is_main: false,
      },
      {
        onConflict: 'user_id,code', // Unique constraint columns
        ignoreDuplicates: false,     // Return the existing row if duplicate
      }
    )
    .select()
    .maybeSingle(); // Use maybeSingle instead of single to avoid error if no row returned

  if (error) {
    console.error('Error adding currency:', error);
    throw new Error(error.message || 'Failed to add currency');
  }

  return data;
},
}
