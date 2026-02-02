-- ============================================================================
-- MIGRATION: Wire Up User Settings Auto-Provisioning
-- Purpose: Connect existing handle_new_user() function to auth.users table
--          so new users automatically get a settings row on signup.
--
-- Context: The handle_new_user() function existed but was never wired to a
--          trigger, causing "cold start" 406 errors (PGRST116) when users
--          signed up but had no settings row.
-- ============================================================================

-- Create the trigger on auth.users to auto-provision settings
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill: Ensure all existing auth users have a settings row
-- Uses ON CONFLICT to be idempotent (safe to run multiple times)
INSERT INTO public.user_settings (user_id)
SELECT id FROM auth.users
WHERE id NOT IN (SELECT user_id FROM public.user_settings)
ON CONFLICT (user_id) DO NOTHING;
